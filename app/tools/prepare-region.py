#!/usr/bin/env python3
"""
Build a regional terrain (heights + baked lighting + optional map lines) from
cached AWS Terrain Tiles (Terrarium) for wide-area shots.

World coordinates match the NEOM scenes: metres, x = east, z = south, with
(0, 0) at the start of The Line's illustrative route. Tiles are Web
Mercator, scaled by cos(latitude of origin) so distances near NEOM are true.

Elevation data: AWS Terrain Tiles (Mapzen/Tilezen, incl. NASA SRTM, ETOPO1).
Map lines: Natural Earth (public domain).

Usage (from app/):
  python3 tools/prepare-region.py neom-wide   out/asset-cache/tiles/wide-z10   --mesh 4 --light 2 --sun 120 40
  python3 tools/prepare-region.py peninsula   out/asset-cache/tiles/peninsula-z6 --mesh 1 --light 1 --sun 300 35 \
      --lines out/asset-cache
"""

import argparse
import glob
import json
import math
import os
import re

import numpy as np
from PIL import Image

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Start of The Line's illustrative route (same point as the NEOM terrain).
ORIGIN_LON = 34.8541
ORIGIN_LAT = 28.0847
R = 6378137.0


def merc(lon, lat):
    return R * math.radians(lon), R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def blur(a, passes=1):
    for _ in range(passes):
        p = np.pad(a, 1, mode="edge")
        a = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] + 4 * a) / 8
    return a


def downsample(a, f):
    if f == 1:
        return a
    h, w = a.shape[0] // f, a.shape[1] // f
    return a[: h * f, : w * f].reshape(h, f, w, f).mean(axis=(1, 3))


def sample(h, rows, cols):
    rows = np.clip(rows, 0, h.shape[0] - 1.001)
    cols = np.clip(cols, 0, h.shape[1] - 1.001)
    r0, c0 = rows.astype(int), cols.astype(int)
    fr, fc = rows - r0, cols - c0
    return (h[r0, c0] * (1 - fr) * (1 - fc) + h[r0 + 1, c0] * fr * (1 - fc)
            + h[r0, c0 + 1] * (1 - fr) * fc + h[r0 + 1, c0 + 1] * fr * fc)


def horizon_tan(h, cell, d_col, d_row, steps, stride=1.0):
    rows, cols = np.mgrid[0:h.shape[0], 0:h.shape[1]].astype(np.float32)
    best = np.full(h.shape, -10.0, np.float32)
    for k in range(1, steps + 1):
        dist = k * stride
        r = rows + d_row * dist
        c = cols + d_col * dist
        inside = (r >= 0) & (r < h.shape[0] - 1) & (c >= 0) & (c < h.shape[1] - 1)
        t = np.where(inside, (sample(h, r, c) - h) / (dist * cell), -10.0)
        np.maximum(best, t, out=best)
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("tiles")
    ap.add_argument("--mesh", type=int, default=4)
    ap.add_argument("--light", type=int, default=2)
    ap.add_argument("--sun", nargs=2, type=float, default=[120, 40])
    ap.add_argument("--lines", help="folder with Natural Earth 10m geojson files")
    args = ap.parse_args()

    files = glob.glob(os.path.join(APP, args.tiles, "*.png"))
    keys = [tuple(map(int, re.findall(r"(\d+)_(\d+)_(\d+)", os.path.basename(f))[0])) for f in files]
    z = keys[0][0]
    xs = sorted({k[1] for k in keys})
    ys = sorted({k[2] for k in keys})
    h = np.zeros((len(ys) * 256, len(xs) * 256), np.float32)
    for f, (_, x, y) in zip(files, keys):
        a = np.asarray(Image.open(f).convert("RGB")).astype(np.float32)
        i, j = ys.index(y), xs.index(x)
        h[i * 256:(i + 1) * 256, j * 256:(j + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768

    n = 2 ** z
    scale = math.cos(math.radians(ORIGIN_LAT))
    world_px = 2 * math.pi * R / (n * 256)  # mercator metres per pixel
    cell = world_px * scale
    # Mercator metres of the mosaic's north-west corner.
    mx0 = (xs[0] / n) * 2 * math.pi * R - math.pi * R
    my0 = math.pi * R - (ys[0] / n) * 2 * math.pi * R
    ox, oy = merc(ORIGIN_LON, ORIGIN_LAT)
    min_x = (mx0 - ox) * scale
    min_z = -(my0 - oy) * scale

    sea = h < 0.5
    hl = downsample(h, args.light)
    lcell = cell * args.light
    az, el = math.radians(args.sun[0]), math.radians(args.sun[1])
    steps = min(400, int(60000 / lcell))
    hz = horizon_tan(hl, lcell, math.sin(az), -math.cos(az), steps=max(steps, 24))
    sun_vis = blur(np.clip((math.tan(el) - hz) / 0.02 + 0.5, 0, 1), 1)
    sky = np.zeros_like(hl)
    for k in range(8):
        a = k * math.pi / 4
        t = horizon_tan(hl, lcell, math.cos(a), math.sin(a), steps=16, stride=2.0)
        sky += 1 - np.sin(np.arctan(np.maximum(t, 0)))
    sky /= 8
    gy, gx = np.gradient(np.maximum(hl, 0), lcell)
    nrm = np.stack([-gx, np.ones_like(gx), -gy], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    slope = 1 - nrm[..., 1]

    out = os.path.join(APP, "public", "terrain", args.name)
    os.makedirs(out, exist_ok=True)
    light = np.stack([sun_vis, sky, np.clip(slope * 3, 0, 1)], -1)
    Image.fromarray((light * 255 + 0.5).astype(np.uint8)).save(os.path.join(out, "light.png"))
    Image.fromarray(((nrm * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8)).save(os.path.join(out, "normals.png"))
    Image.fromarray((downsample(sea.astype(np.float32), args.light) * 255 + 0.5).astype(np.uint8)).save(os.path.join(out, "sea.png"))
    hm = downsample(h, args.mesh).astype(np.float32)
    hm.tofile(os.path.join(out, "heights.f32"))

    meta = {
        "source": "AWS Terrain Tiles (Terrarium, zoom %d) - Mapzen/Tilezen, incl. NASA SRTM, ETOPO1" % z,
        "cellSizeM": cell,
        "widthM": h.shape[1] * cell,
        "depthM": h.shape[0] * cell,
        "minX": min_x,
        "minZ": min_z,
        "mesh": {"cols": hm.shape[1], "rows": hm.shape[0], "file": "heights.f32"},
        "light": {"cols": hl.shape[1], "rows": hl.shape[0]},
        "heightRange": [float(h.min()), float(h.max())],
        "sun": {"azimuthDeg": args.sun[0], "elevationDeg": args.sun[1]},
        "origin": {"lon": ORIGIN_LON, "lat": ORIGIN_LAT},
    }

    if args.lines:
        lon_w = mx0 / R * 180 / math.pi
        lon_e = (mx0 + h.shape[1] * world_px) / R * 180 / math.pi
        lat_n = math.degrees(2 * math.atan(math.exp(my0 / R)) - math.pi / 2)
        lat_s = math.degrees(2 * math.atan(math.exp((my0 - h.shape[0] * world_px) / R)) - math.pi / 2)

        def project(lon, lat):
            mx, my = merc(lon, lat)
            return [round((mx - ox) * scale, 1), round(-(my - oy) * scale, 1)]

        def inside(lon, lat):
            return lon_w - 1 <= lon <= lon_e + 1 and lat_s - 1 <= lat <= lat_n + 1

        lines = {}
        for kind, fname in (("coast", "ne_10m_coastline.geojson"),
                            ("lakes", "ne_10m_lakes.geojson")):
            gj = json.load(open(os.path.join(APP, args.lines, fname)))
            polys = []
            for feat in gj["features"]:
                g = feat["geometry"]
                parts = []
                if g["type"] == "LineString":
                    parts = [g["coordinates"]]
                elif g["type"] == "MultiLineString":
                    parts = g["coordinates"]
                elif g["type"] == "Polygon":
                    parts = g["coordinates"]
                elif g["type"] == "MultiPolygon":
                    parts = [ring for poly in g["coordinates"] for ring in poly]
                for part in parts:
                    seg = []
                    for lon, lat in part:
                        if inside(lon, lat):
                            seg.append(project(lon, lat))
                        elif len(seg) > 1:
                            polys.append(seg)
                            seg = []
                        else:
                            seg = []
                    if len(seg) > 1:
                        polys.append(seg)
            lines[kind] = polys
        # Land borders: country polygon edges that are not coastline.
        gj = json.load(open(os.path.join(APP, args.lines, "ne_10m_admin_0_countries.geojson")))
        countries = {}
        for feat in gj["features"]:
            name = feat["properties"].get("NAME") or feat["properties"].get("ADMIN")
            g = feat["geometry"]
            rings = [g["coordinates"][0]] if g["type"] == "Polygon" else [p[0] for p in g["coordinates"]]
            keep = []
            for ring in rings:
                if any(inside(lon, lat) for lon, lat in ring[:: max(1, len(ring) // 50)]):
                    keep.append([project(lon, lat) for lon, lat in ring])
            if keep:
                countries[name] = keep
        lines["countries"] = countries
        with open(os.path.join(out, "lines.json"), "w") as f:
            json.dump(lines, f, separators=(",", ":"))
        meta["lines"] = "lines.json"

    with open(os.path.join(out, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print(f"{args.name}: zoom {z}, {h.shape[1]}x{h.shape[0]} px, cell {cell:.0f} m, "
          f"area {meta['widthM']/1000:.0f} x {meta['depthM']/1000:.0f} km, mesh {hm.shape[1]}x{hm.shape[0]}, "
          f"heights {h.min():.0f}..{h.max():.0f} m")


if __name__ == "__main__":
    main()
