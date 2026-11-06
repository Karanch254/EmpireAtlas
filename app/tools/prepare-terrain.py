#!/usr/bin/env python3
"""
Prepare the NEOM terrain used by the 3D scenes.

Data source: AWS Terrain Tiles (Terrarium format, zoom 12, ~34 m/pixel),
a free open dataset built mainly from NASA SRTM and other open sources.
Attribution for the video description:
  "Elevation data: AWS Terrain Tiles (Mapzen/Tilezen), incl. NASA SRTM."

What this tool does
-------------------
1. Downloads (and caches) the elevation tiles for the NEOM region.
2. Crops a ~103 x 69 km area around the illustrative route of The Line.
3. Grades a corridor under the route (a real megaproject would level it).
4. Pre-computes lighting for a June sunrise, once, so rendering stays fast:
   - mountain-on-mountain sun shadows (horizon ray-marching),
   - sky visibility (ambient occlusion),
   - surface normals.
5. Writes everything to public/terrain/neom/.

The route of the walls is ILLUSTRATIVE: it is placed on the flattest long
corridor in the real terrain, not on surveyed project coordinates.

Requirements: Python 3, numpy, Pillow, internet access for the first run.
Usage (from app/):  python3 tools/prepare-terrain.py
"""

import json
import math
import os
import urllib.request

import numpy as np
from PIL import Image

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(APP, "out", "terrain-cache")
OUT = os.path.join(APP, "public", "terrain", "neom")

ZOOM = 12
TILES_X = range(2443, 2456)
TILES_Y = range(1708, 1719)
# Crop of the full-resolution mosaic (pixels).
CROP_X = (0, 3072)
CROP_Y = (256, 2304)

# Illustrative route (full-resolution mosaic pixels, compass bearing, length).
ROUTE_START_PX = (400.0, 1750.0)
ROUTE_BEARING_DEG = 70.0
ROUTE_LENGTH_M = 45000.0

# Equinox sunrise over NEOM (~28.2 N): azimuth ~88 deg, a few degrees up.
# (Chosen for composition: sun to the right of the route, not behind it.)
SUN_AZIMUTH_DEG = 88.0
SUN_ELEVATION_DEG = 5.5

MESH_DOWNSAMPLE = 4  # heights for the mesh (~135 m spacing)
# Full-resolution (~34 m) detail patch where cameras fly low, in route
# coordinates: t (along) and s (to the left / north) ranges in metres.
DETAIL_PATCH_T = (-1500.0, 14000.0)
DETAIL_PATCH_S = (-7500.0, 900.0)
LIGHT_DOWNSAMPLE = 2  # lighting textures (~67 m)


def lat_of_row(row):
    n = 2 ** ZOOM
    return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (TILES_Y[0] + row / 256) / n))))


def mosaic():
    os.makedirs(CACHE, exist_ok=True)
    m = np.zeros((len(TILES_Y) * 256, len(TILES_X) * 256), np.float32)
    for i, y in enumerate(TILES_Y):
        for j, x in enumerate(TILES_X):
            path = os.path.join(CACHE, f"{ZOOM}_{x}_{y}.png")
            if not os.path.exists(path):
                url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZOOM}/{x}/{y}.png"
                urllib.request.urlretrieve(url, path)
            a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
            m[i * 256:(i + 1) * 256, j * 256:(j + 1) * 256] = (
                a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
            )
    return m


def downsample(a, f):
    h, w = a.shape[0] // f, a.shape[1] // f
    return a[: h * f, : w * f].reshape(h, f, w, f).mean(axis=(1, 3))


def blur(a, passes=1):
    for _ in range(passes):
        p = np.pad(a, 1, mode="edge")
        a = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] + 4 * a) / 8
    return a


def sample(h, rows, cols):
    rows = np.clip(rows, 0, h.shape[0] - 1.001)
    cols = np.clip(cols, 0, h.shape[1] - 1.001)
    r0, c0 = rows.astype(int), cols.astype(int)
    fr, fc = rows - r0, cols - c0
    return (h[r0, c0] * (1 - fr) * (1 - fc) + h[r0 + 1, c0] * fr * (1 - fc)
            + h[r0, c0 + 1] * (1 - fr) * fc + h[r0 + 1, c0 + 1] * fr * fc)


def horizon_tan(h, cell, d_col, d_row, steps, stride=1.0):
    """Max tan(elevation angle) of terrain seen from each cell along a direction."""
    rows, cols = np.mgrid[0:h.shape[0], 0:h.shape[1]].astype(np.float32)
    best = np.full(h.shape, -10.0, np.float32)
    for k in range(1, steps + 1):
        dist = k * stride
        r = rows + d_row * dist
        c = cols + d_col * dist
        inside = (r >= 0) & (r < h.shape[0] - 1) & (c >= 0) & (c < h.shape[1] - 1)
        hh = sample(h, r, c)
        t = np.where(inside, (hh - h) / (dist * cell), -10.0)
        np.maximum(best, t, out=best)
    return best


def main():
    full = mosaic()
    lat = lat_of_row((CROP_Y[0] + CROP_Y[1]) / 2)
    cell = 40075016.686 * math.cos(math.radians(lat)) / (2 ** ZOOM * 256)
    h = full[CROP_Y[0]:CROP_Y[1], CROP_X[0]:CROP_X[1]].copy()
    sea = h < 1.0
    h = np.maximum(h, -30.0)

    # Route geometry in crop pixels.
    sx = ROUTE_START_PX[0] - CROP_X[0]
    sy = ROUTE_START_PX[1] - CROP_Y[0]
    b = math.radians(ROUTE_BEARING_DEG)
    dcol, drow = math.sin(b), -math.cos(b)
    rows, cols = np.mgrid[0:h.shape[0], 0:h.shape[1]].astype(np.float32)
    along = ((cols - sx) * dcol + (rows - sy) * drow) * cell
    side = ((cols - sx) * -drow + (rows - sy) * dcol) * cell

    # Smooth base profile of the route (quadratic fit of the terrain).
    t = np.linspace(0, ROUTE_LENGTH_M, 400)
    prof = sample(blur(h, 6), sy + drow * t / cell, sx + dcol * t / cell)
    coeffs = np.polyfit(t, prof, 2)
    base = np.polyval(coeffs, np.clip(along, 0, ROUTE_LENGTH_M))

    # Grade a corridor: flat under the structure, blending out to 900 m.
    lateral = np.clip((np.abs(side) - 300.0) / 600.0, 0, 1)
    ends = np.clip(np.maximum(-along, along - ROUTE_LENGTH_M) / 600.0, 0, 1)
    w = 1 - np.maximum(lateral, ends)
    w = w * w * (3 - 2 * w)
    h = h * (1 - w) + base * w

    # Lighting at LIGHT_DOWNSAMPLE resolution.
    hl = downsample(h, LIGHT_DOWNSAMPLE)
    lcell = cell * LIGHT_DOWNSAMPLE
    az = math.radians(SUN_AZIMUTH_DEG)
    el = math.radians(SUN_ELEVATION_DEG)
    sun_tan = math.tan(el)
    hz = horizon_tan(hl, lcell, math.sin(az), -math.cos(az), steps=380)
    sun_vis = np.clip((sun_tan - hz) / 0.02 + 0.5, 0, 1)
    sun_vis = blur(sun_vis, 1)

    sky = np.zeros_like(hl)
    for k in range(8):
        a = k * math.pi / 4
        tmax = horizon_tan(hl, lcell, math.cos(a), math.sin(a), steps=24, stride=2.0)
        sky += 1 - np.sin(np.arctan(np.maximum(tmax, 0)))
    sky /= 8

    gy, gx = np.gradient(hl, lcell)
    # World axes: x = east (+col), y = up, z = south (+row).
    n = np.stack([-gx, np.ones_like(gx), -gy], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    slope = 1 - n[..., 1]

    os.makedirs(OUT, exist_ok=True)
    light = np.stack([sun_vis, sky, np.clip(slope * 3, 0, 1)], -1)
    Image.fromarray((light * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, "light.png"))
    Image.fromarray(((n * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, "normals.png"))
    sea_l = downsample(sea.astype(np.float32), LIGHT_DOWNSAMPLE)
    Image.fromarray((sea_l * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, "sea.png"))

    hm = downsample(h, MESH_DOWNSAMPLE).astype(np.float32)
    hm.tofile(os.path.join(OUT, "heights.f32"))

    width_m = h.shape[1] * cell
    depth_m = h.shape[0] * cell
    origin_x = sx * cell  # world x of the crop's left edge is -origin_x
    origin_z = sy * cell

    # Detail patch: axis-aligned bounding box of the route-space rectangle.
    left_x, left_z = drow, -dcol  # route "left" in (x east, z south)
    corners = [(t * dcol + s_ * left_x, t * drow + s_ * left_z)
               for t in DETAIL_PATCH_T for s_ in DETAIL_PATCH_S]
    c0 = int(math.floor((min(c[0] for c in corners) + origin_x) / cell))
    c1 = int(math.ceil((max(c[0] for c in corners) + origin_x) / cell))
    r0 = int(math.floor((min(c[1] for c in corners) + origin_z) / cell))
    r1 = int(math.ceil((max(c[1] for c in corners) + origin_z) / cell))
    c0, r0 = max(c0, 0), max(r0, 0)
    c1, r1 = min(c1, h.shape[1]), min(r1, h.shape[0])
    patch = h[r0:r1, c0:c1].astype(np.float32)
    patch.tofile(os.path.join(OUT, "patch-heights.f32"))
    meta = {
        "source": "AWS Terrain Tiles (Terrarium, zoom 12) - Mapzen/Tilezen, incl. NASA SRTM",
        "cellSizeM": cell,
        "widthM": width_m,
        "depthM": depth_m,
        # World position of the crop's north-west corner (x east, z south).
        "minX": -origin_x,
        "minZ": -origin_z,
        "mesh": {"cols": hm.shape[1], "rows": hm.shape[0], "file": "heights.f32"},
        # Full-resolution patch; vertex (r, c) sits at the centre of its cell.
        "patch": {
            "cols": patch.shape[1],
            "rows": patch.shape[0],
            "minX": c0 * cell - origin_x,
            "minZ": r0 * cell - origin_z,
            "file": "patch-heights.f32",
        },
        "light": {"cols": hl.shape[1], "rows": hl.shape[0]},
        "heightRange": [float(h.min()), float(h.max())],
        "route": {
            "bearingDeg": ROUTE_BEARING_DEG,
            "lengthM": ROUTE_LENGTH_M,
            "baseProfile": [float(c) for c in coeffs],
            "note": "Illustrative alignment on real terrain, not surveyed coordinates.",
        },
        "sun": {"azimuthDeg": SUN_AZIMUTH_DEG, "elevationDeg": SUN_ELEVATION_DEG},
    }
    with open(os.path.join(OUT, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print(f"cell {cell:.2f} m, area {width_m/1000:.1f} x {depth_m/1000:.1f} km, "
          f"mesh {hm.shape[1]}x{hm.shape[0]}, light {hl.shape[1]}x{hl.shape[0]}, "
          f"heights {h.min():.0f}..{h.max():.0f} m, route base {prof.min():.0f}..{prof.max():.0f} m")


if __name__ == "__main__":
    main()
