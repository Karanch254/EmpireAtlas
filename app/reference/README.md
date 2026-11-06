# Approved visual references

`scene01-approved/` is the approved Scene 1 ("The impossible city") and the
visual-quality reference for the rest of the documentary.

- `scene01-refined-540p.mp4` - approved preview (960x540, 30 fps, 605 frames)
- `after-f252/330/500-1080p.png` - 1080p reference stills
- `shoreline-after-1080p.mp4` - 1080p shoreline stability clip (frames 225-285)
- `source-fingerprint.sha256` - SHA-256 of every source/terrain file that
  produced the approved version (`sha256sum -c` from `app/`)

Any change to shared code must keep these frames pixel-identical.
