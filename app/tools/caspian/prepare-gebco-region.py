#!/usr/bin/env python3
"""
Build a MapTerrain region (heights + baked lighting + map lines) for the
Caspian from a GEBCO GeoTIFF subset.

Why a separate tool: tools/prepare-region.py (The Line) reads AWS terrain
tiles and treats 0 m as sea level (it flattens everything below 0 m for
slopes and marks h < 0.5 m as sea). The Caspian's surface lies ~28-29 m
BELOW mean sea level, so its seabed relief must be kept as measured.

Input:  GEBCO_2026 Grid subset (GeoTIFF, WGS84 lon/lat, 15 arc-second,
        elevation in metres relative to Mean Sea Level), unmodified.
Output: public/terrain/<name>/ heights.f32, light.png, normals.png,
        lines.json, meta.json - the same format MapTerrain loads.
Projection: Web Mercator scaled by cos(origin latitude), like The Line's
regions (distances are true near the origin latitude; +-7% across 36-48N).

Processing (documented, deterministic):
  1. bilinear resampling of the lon/lat grid onto a regular Mercator grid
     (cell = --cell metres);
  2. sun-visibility (horizon) and sky-occlusion bake on the resampled
     heights, normals from the same heights (no clamping at 0 m);
  3. Natural Earth coastline/countries projected for reference lines.
No elevation values are edited, smoothed or invented.

Usage (from app/):
  python3 tools/caspian/prepare-gebco-region.py caspian-gebco \
     out/preprod-caspian/sources/gebco/original/gebco_2026_n48.0_s36.0_w46.0_e55.5_geotiff.tif \
     --west 46 --north 48 --res 240 --cell 500 --lines out/preprod-caspian/sources/naturalearth
"""
import argparse
import importlib.util
import json
import math
import os

import numpy as np
from PIL import Image

APP = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location("pr", os.path.join(APP, "tools", "prepare-region.py"))
pr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pr)  # reuse blur / downsample / sample / horizon_tan unchanged
R = 6378137.0


def merc(lon, lat):
    return R * np.radians(lon), R * np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("geotiff")
    ap.add_argument("--west", type=float, required=True)
    ap.add_argument("--north", type=float, required=True)
    ap.add_argument("--res", type=float, default=240, help="cells per degree (15 arc-second = 240)")
    ap.add_argument("--cell", type=float, default=500, help="output cell size in metres")
    ap.add_argument("--origin", nargs=2, type=float, default=[50.5, 42.0], help="lon lat")
    ap.add_argument("--sun", nargs=2, type=float, default=[230, 35])
    ap.add_argument("--lines", help="folder with Natural Earth 10m geojson files")
    ap.add_argument("--smooth", type=int, default=0,
                    help="light blur passes after resampling (suppresses GEBCO's 1 m integer steps)")
    args = ap.parse_args()

    src = np.array(Image.open(os.path.join(APP, args.geotiff))).astype(np.float32)
    rows, cols = src.shape
    east = args.west + cols / args.res
    south = args.north - rows / args.res
    olon, olat = args.origin
    k = math.cos(math.radians(olat))
    ox, oy = merc(olon, olat)
    mx_w, my_n = merc(args.west, args.north)
    mx_e, my_s = merc(east, south)
    min_x, max_x = (mx_w - ox) * k, (mx_e - ox) * k
    min_z, max_z = -(my_n - oy) * k, -(my_s - oy) * k
    nc = int((max_x - min_x) / args.cell)
    nr = int((max_z - min_z) / args.cell)

    # 1. Resample: centre of each output cell -> lon/lat -> source grid.
    xs = min_x + (np.arange(nc) + 0.5) * args.cell
    zs = min_z + (np.arange(nr) + 0.5) * args.cell
    lon = np.degrees(xs / k / R + ox / R)
    my = -zs / k + oy
    lat = np.degrees(2 * np.arctan(np.exp(my / R)) - np.pi / 2)
    cc = (lon - args.west) * args.res - 0.5
    rr = (args.north - lat) * args.res - 0.5
    h = pr.sample(src, rr[:, None] + 0 * cc[None, :], cc[None, :] + 0 * rr[:, None]).astype(np.float32)
    # 1b. Optional light smoothing: GEBCO stores whole metres, so flat
    # lowland near a contour level breaks into speckle. A few 3x3 passes
    # (~0.7 km) remove the 1 m steps; the change is measured and reported.
    if args.smooth:
        raw = h.copy()
        h = pr.blur(h, args.smooth).astype(np.float32)
        d = np.abs(h - raw)[(raw > -45) & (raw < -20)]
        print(f"smoothing {args.smooth} passes: shelf (-45..-20 m) change median {np.median(d):.2f} m, "
              f"95th pct {np.percentile(d, 95):.2f} m")

    # 2. Lighting bake (same method as prepare-region.py, no 0 m clamp).
    cell = args.cell
    az, el = math.radians(args.sun[0]), math.radians(args.sun[1])
    steps = min(400, int(60000 / cell))
    hz = pr.horizon_tan(h, cell, math.sin(az), -math.cos(az), steps=max(steps, 24))
    sun_vis = pr.blur(np.clip((math.tan(el) - hz) / 0.02 + 0.5, 0, 1), 1)
    sky = np.zeros_like(h)
    for i in range(8):
        a = i * math.pi / 4
        t = pr.horizon_tan(h, cell, math.cos(a), math.sin(a), steps=16, stride=2.0)
        sky += 1 - np.sin(np.arctan(np.maximum(t, 0)))
    sky /= 8
    gy, gx = np.gradient(h, cell)
    nrm = np.stack([-gx, np.ones_like(gx), -gy], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    slope = 1 - nrm[..., 1]

    out = os.path.join(APP, "public", "terrain", args.name)
    os.makedirs(out, exist_ok=True)
    light = np.stack([sun_vis, sky, np.clip(slope * 3, 0, 1)], -1)
    Image.fromarray((light * 255 + 0.5).astype(np.uint8)).save(os.path.join(out, "light.png"))
    Image.fromarray(((nrm * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8)).save(os.path.join(out, "normals.png"))
    h.tofile(os.path.join(out, "heights.f32"))
    meta = {
        "source": "GEBCO_2026 Grid (15 arc-second), GEBCO Compilation Group (2026); "
                  "subset n%.1f s%.1f w%.1f e%.1f; elevations relative to Mean Sea Level"
                  % (args.north, south, args.west, east),
        "cellSizeM": cell,
        "widthM": nc * cell,
        "depthM": nr * cell,
        "minX": float(min_x),
        "minZ": float(min_z),
        "mesh": {"cols": nc, "rows": nr, "file": "heights.f32"},
        "light": {"cols": nc, "rows": nr},
        "heightRange": [float(h.min()), float(h.max())],
        "sun": {"azimuthDeg": args.sun[0], "elevationDeg": args.sun[1]},
        "origin": {"lon": olon, "lat": olat},
        "processing": "bilinear resample to %.0f m Mercator grid; %d light 3x3 smoothing passes" % (cell, args.smooth),
    }

    # 3. Reference lines from Natural Earth (coastline, countries).
    if args.lines:
        def project(lo, la):
            mx, my2 = merc(lo, la)
            return [round(float((mx - ox) * k), 1), round(float(-(my2 - oy) * k), 1)]

        def inside(lo, la):
            return args.west - 1 <= lo <= east + 1 and south - 1 <= la <= args.north + 1

        def parts_of(g):
            t = g["type"]
            if t == "LineString":
                return [g["coordinates"]]
            if t in ("MultiLineString", "Polygon"):
                return g["coordinates"]
            if t == "MultiPolygon":
                return [ring for poly in g["coordinates"] for ring in poly]
            return []

        lines = {"coast": [], "lakes": [], "countries": {}}
        for kind, fname in (("coast", "ne_10m_coastline.geojson"), ("lakes", "ne_10m_lakes.geojson")):
            for feat in json.load(open(os.path.join(APP, args.lines, fname)))["features"]:
                for part in parts_of(feat["geometry"]):
                    seg = []
                    for lo, la in part:
                        if inside(lo, la):
                            seg.append(project(lo, la))
                        else:
                            if len(seg) > 1:
                                lines[kind].append(seg)
                            seg = []
                    if len(seg) > 1:
                        lines[kind].append(seg)
        for feat in json.load(open(os.path.join(APP, args.lines, "ne_10m_admin_0_countries.geojson")))["features"]:
            name = feat["properties"].get("NAME") or feat["properties"].get("ADMIN")
            g = feat["geometry"]
            rings = [g["coordinates"][0]] if g["type"] == "Polygon" else [p[0] for p in g["coordinates"]]
            keep = [[project(lo, la) for lo, la in ring] for ring in rings
                    if any(inside(lo, la) for lo, la in ring[:: max(1, len(ring) // 50)])]
            if keep:
                lines["countries"][name] = keep
        with open(os.path.join(out, "lines.json"), "w") as f:
            json.dump(lines, f, separators=(",", ":"))
        meta["lines"] = "lines.json"

    with open(os.path.join(out, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print(f"{args.name}: {nc}x{nr} cells of {cell:.0f} m ({nc*cell/1000:.0f} x {nr*cell/1000:.0f} km), "
          f"heights {h.min():.0f}..{h.max():.0f} m, origin {olon},{olat}")


if __name__ == "__main__":
    main()
