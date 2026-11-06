<#
EmpireAtlas render benchmark for Windows (Windows PowerShell 5.1 or PowerShell 7).

What it does
  1. Makes sure Remotion's own Chrome is downloaded, then finds it.
  2. Checks which graphics device Chrome really uses, in both modes, by
     loading tools\gpu-probe.html with Chrome's --dump-dom option
     (chrome://gpu cannot be opened by the headless renderer, so it is not used;
     the result is read from Chrome's printed output or its log files):
       CPU mode : --use-gl=angle --use-angle=swiftshader  (= Remotion --gl=swangle)
       GPU mode : --use-gl=angle                          (= Remotion --gl=angle, Direct3D 11)
     Each mode gets a verdict: HARDWARE_AMD, HARDWARE_OTHER, SOFTWARE or NO_WEBGL.
  3. Runs the same controlled Scene 1 tests used in the cloud:
       single frame (480), 30 frames (480-509), 60 frames (480-539)
     in CPU mode, and in GPU mode only if the GPU check found real hardware.
  4. While each test runs, samples CPU %, RAM, GPU 3D-engine use and GPU memory
     every 2 seconds using Windows performance counters.

Results (in app\out\bench\):
  results.csv          one row per test
  gpu-report.txt       graphics adapters + both GPU-check results
  CPU-f480.png / GPU-f480.png   the same frame from each mode, to compare

Usage, from the app folder:
  powershell -ExecutionPolicy Bypass -File tools\benchmark-render.ps1
Options:  -Scale 0.5   (540p instead of 1080p)
          -Concurrency 1   (frames rendered in parallel; default = Remotion's choice)
          -GpuCheckOnly    (only run the GPU check, takes about a minute)
Nothing is uploaded anywhere and no paid services are used.
#>
param(
  [double]$Scale = 1,
  [int]$Concurrency = 0,
  [switch]$GpuCheckOnly
)

# Remotion prints progress on stderr; never treat that as a fatal error.
$ErrorActionPreference = "Continue"
$out = "out\bench"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$report = Join-Path $out "gpu-report.txt"

# The cloud-only settings must not leak into this test.
Remove-Item Env:REMOTION_GL -ErrorAction SilentlyContinue
Remove-Item Env:REMOTION_BROWSER_EXECUTABLE -ErrorAction SilentlyContinue

if (-not (Test-Path "package.json") -or -not (Test-Path "tools\gpu-probe.html")) {
  Write-Host "Please run this from the app folder (the one containing package.json)." -ForegroundColor Red
  exit 1
}

# ---------------------------------------------------------------- GPU check
Write-Host "Step 1/3: making sure Remotion's Chrome is installed..."
& npx remotion browser ensure
$chrome = Get-ChildItem "node_modules\.remotion" -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -in @("chrome-headless-shell.exe", "headless_shell.exe") } |
  Select-Object -First 1
if (-not $chrome) {
  Write-Host "Could not find Remotion's Chrome under node_modules\.remotion." -ForegroundColor Red
  exit 1
}
Write-Host "  Using $($chrome.FullName)"

Write-Host "Step 2/3: checking which graphics device Chrome really uses..."
$adapters = Get-CimInstance Win32_VideoController |
  Select-Object Name, DriverVersion, @{ n = "VRAM_MB"; e = { [math]::Round($_.AdapterRAM / 1MB) } }
"Graphics adapters reported by Windows:" | Set-Content $report
($adapters | Format-Table -AutoSize | Out-String) | Add-Content $report

$probeUrl = ([System.Uri](Resolve-Path "tools\gpu-probe.html").Path).AbsoluteUri

# Chrome can report the probe result in three places. Windows does not always
# pass headless Chrome's printed output (stdout) through, so all are checked:
#   1. stdout          - the page text printed by --dump-dom
#   2. stderr          - console messages, when --enable-logging prints them
#   3. chrome_debug.log - console messages written into the temporary profile
function Find-ProbeResult([string[]]$paths) {
  foreach ($path in $paths) {
    if (-not $path -or -not (Test-Path -LiteralPath $path)) { continue }
    $content = Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
    # Windows PowerShell 5.1 returns $null (not "") for an empty file.
    if ([string]::IsNullOrEmpty($content)) { continue }
    if ($content -match 'EA_GPU_PROBE (\{[^\r\n]*\})') {
      try { return @{ json = ($Matches[1] | ConvertFrom-Json); source = $path } } catch {}
    }
  }
  return $null
}

function Invoke-Probe($mode, [string[]]$glArgs) {
  $id = [guid]::NewGuid().ToString()
  $probeProfile = Join-Path $env:TEMP "ea-gpu-probe-$id"
  $stdoutFile = Join-Path $env:TEMP "ea-gpu-probe-$id.out.txt"
  $stderrFile = Join-Path $env:TEMP "ea-gpu-probe-$id.err.txt"
  # Start-Process does not quote arguments, so quote the paths ourselves.
  $chromeArgs = @("--headless", "--user-data-dir=`"$probeProfile`"", "--disable-skia-graphite",
    "--enable-logging", "--v=0") + $glArgs + @("--dump-dom", "`"$probeUrl`"")
  $exitInfo = "not started"
  try {
    $p = Start-Process -FilePath $chrome.FullName -ArgumentList $chromeArgs -NoNewWindow -PassThru `
      -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
    $null = $p.Handle  # keeps the exit code available after the process ends
    if ($p.WaitForExit(120000)) { $exitInfo = "exit code $($p.ExitCode)" }
    else { try { $p.Kill() } catch {}; $exitInfo = "timed out after 120 s and was stopped" }
  } catch {
    $exitInfo = "could not start Chrome: $($_.Exception.Message)"
  }
  Start-Sleep -Milliseconds 800  # let Chrome finish writing its log files

  $debugLogs = @(Get-ChildItem -LiteralPath $probeProfile -Recurse -Filter "chrome_debug.log" -ErrorAction SilentlyContinue |
    ForEach-Object { $_.FullName })
  $found = Find-ProbeResult (@($stdoutFile, $stderrFile) + $debugLogs)

  if ($found) {
    $r = $found.json
    $via = Split-Path $found.source -Leaf
  } else {
    $r = [pscustomobject]@{ webgl2 = $false; verdict = "PROBE_FAILED" }
    $via = "none"
    # Keep everything Chrome produced so the failure can be diagnosed.
    $diag = Join-Path $out "probe-$mode"
    New-Item -ItemType Directory -Force -Path $diag | Out-Null
    Copy-Item -LiteralPath $stdoutFile -Destination (Join-Path $diag "stdout.txt") -ErrorAction SilentlyContinue
    Copy-Item -LiteralPath $stderrFile -Destination (Join-Path $diag "stderr.txt") -ErrorAction SilentlyContinue
    $n = 0
    foreach ($log in $debugLogs) { $n++; Copy-Item -LiteralPath $log -Destination (Join-Path $diag "chrome_debug_$n.log") -ErrorAction SilentlyContinue }
    Write-Host "  $mode mode: Chrome returned no probe result ($exitInfo)." -ForegroundColor Yellow
    Write-Host "  Chrome: $($chrome.FullName)" -ForegroundColor Yellow
    Write-Host "  Diagnostics saved to $diag" -ForegroundColor Yellow
    $tail = Get-Content -LiteralPath $stderrFile -Tail 8 -ErrorAction SilentlyContinue
    if ($tail) { Write-Host "  Last lines Chrome printed:"; $tail | ForEach-Object { Write-Host "    $_" } }
  }
  Remove-Item -LiteralPath $stdoutFile, $stderrFile -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $probeProfile -Recurse -Force -ErrorAction SilentlyContinue

  Add-Content $report ""
  Add-Content $report ("[{0} mode] Chrome flags: {1}" -f $mode, ($glArgs -join " "))
  Add-Content $report ("  Chrome:    {0}" -f $exitInfo)
  Add-Content $report ("  result in: {0}" -f $via)
  Add-Content $report ("  verdict:   {0}" -f $r.verdict)
  Add-Content $report ("  renderer:  {0}" -f $r.renderer)
  Add-Content $report ("  vendor:    {0}" -f $r.vendor)
  Add-Content $report ("  workload:  {0} ms (40 full-HD shader passes; lower is faster)" -f $r.workloadMs)
  $colour = if ($r.verdict -like "HARDWARE*") { "Green" } else { "Yellow" }
  Write-Host ("  {0} mode: {1}  ({2})  workload {3} ms" -f $mode, $r.verdict, $r.renderer, $r.workloadMs) -ForegroundColor $colour
  return $r
}

$cpuProbe = Invoke-Probe "CPU" @("--use-gl=angle", "--use-angle=swiftshader")
$gpuProbe = Invoke-Probe "GPU" @("--use-gl=angle")
$gpuUsable = $gpuProbe.verdict -like "HARDWARE*"
Add-Content $report ""
if ($gpuUsable) {
  Add-Content $report "RESULT: Chrome is using real graphics hardware in GPU mode."
} else {
  Add-Content $report "RESULT: Chrome is NOT using the Radeon GPU in GPU mode; GPU render tests will be skipped."
}
if ($GpuCheckOnly) {
  Write-Host "GPU check finished. Report: $report"
  exit 0
}

# ---------------------------------------------------------------- Render tests
Write-Host "Step 3/3: render benchmarks (this takes a while; please leave the PC alone)..."
$csv = Join-Path $out "results.csv"
"mode,test,frames,scale,concurrency,seconds,sec_per_frame,cpu_avg_pct,cpu_max_pct,ram_used_max_gb,gpu3d_avg_pct,gpu3d_max_pct,gpu_mem_max_gb,ok" |
  Set-Content $csv
$totalRamGb = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB

function Start-Sampler {
  Start-Job -ScriptBlock {
    $counters = @(
      '\Processor(_Total)\% Processor Time',
      '\Memory\Available MBytes',
      '\GPU Engine(*engtype_3D)\Utilization Percentage',
      '\GPU Adapter Memory(*)\Shared Usage',
      '\GPU Adapter Memory(*)\Dedicated Usage'
    )
    while ($true) {
      try {
        $s = Get-Counter -Counter $counters -ErrorAction SilentlyContinue
        $cpu = ($s.CounterSamples | Where-Object Path -like '*processor time*').CookedValue
        $avail = ($s.CounterSamples | Where-Object Path -like '*available mbytes*').CookedValue
        $gpu = ($s.CounterSamples | Where-Object Path -like '*engtype_3d*' | Measure-Object CookedValue -Sum).Sum
        $mem = ($s.CounterSamples | Where-Object Path -like '*adapter memory*' | Measure-Object CookedValue -Sum).Sum
        [pscustomobject]@{ cpu = $cpu; avail = $avail; gpu = $gpu; mem = $mem }
      } catch {}
      Start-Sleep -Seconds 2
    }
  }
}

function Run-Test($mode, $gl, $test, [string[]]$cmdArgs, $frames) {
  Write-Host ("[{0}] {1} ..." -f $mode, $test)
  $job = Start-Sampler
  $sw = [Diagnostics.Stopwatch]::StartNew()
  & npx @cmdArgs "--gl=$gl" "--scale=$Scale" "--log=error"
  $ok = ($LASTEXITCODE -eq 0)
  $sw.Stop()
  Stop-Job $job | Out-Null
  $samples = @(Receive-Job $job)
  Remove-Job $job | Out-Null
  $sec = [math]::Round($sw.Elapsed.TotalSeconds, 1)
  $cpu = $samples | Measure-Object cpu -Average -Maximum
  $ram = $samples | Measure-Object avail -Minimum
  $gpu = $samples | Measure-Object gpu -Average -Maximum
  $gmem = $samples | Measure-Object mem -Maximum
  $ramUsed = if ($ram.Minimum) { [math]::Round($totalRamGb - $ram.Minimum / 1024, 2) } else { "" }
  $row = @(
    $mode, $test, $frames, $Scale, $Concurrency, $sec,
    [math]::Round($sec / $frames, 2),
    [math]::Round([double]$cpu.Average, 0), [math]::Round([double]$cpu.Maximum, 0), $ramUsed,
    [math]::Round([double]$gpu.Average, 0), [math]::Round([double]$gpu.Maximum, 0),
    [math]::Round([double]$gmem.Maximum / 1GB, 2), $ok
  ) -join ","
  Add-Content $csv $row
  $colour = if ($ok) { "Green" } else { "Red" }
  Write-Host ("    {0} s ({1} s/frame) ok={2}" -f $sec, [math]::Round($sec / $frames, 2), $ok) -ForegroundColor $colour
}

$conc = @()
if ($Concurrency -gt 0) { $conc = @("--concurrency=$Concurrency") }

$modes = @(@{ name = "CPU"; gl = "swangle" })
if ($gpuUsable) { $modes += @{ name = "GPU"; gl = "angle" } }
else { Add-Content $csv "GPU,skipped,0,$Scale,$Concurrency,,,,,,,,,GPU not hardware-accelerated" }

foreach ($m in $modes) {
  Run-Test $m.name $m.gl "single-frame" @("remotion", "still", "NeomScene01", "$out\$($m.name)-f480.png", "--frame=480") 1
  Run-Test $m.name $m.gl "30-frames" (@("remotion", "render", "NeomScene01", "$out\$($m.name)-30.mp4", "--frames=480-509") + $conc) 30
  Run-Test $m.name $m.gl "60-frames" (@("remotion", "render", "NeomScene01", "$out\$($m.name)-60.mp4", "--frames=480-539") + $conc) 60
}

Write-Host ""
Write-Host "Done. Please send these files back:" -ForegroundColor Green
Write-Host "  $csv"
Write-Host "  $report"
Write-Host "  $out\CPU-f480.png"
if ($gpuUsable) { Write-Host "  $out\GPU-f480.png" }
