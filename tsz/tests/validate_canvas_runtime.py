#!/usr/bin/env python3
"""Runtime Canvas layout validator.

Launches the storybook app with CANVAS_DUMP=1, captures the canvas node dump
after the first rendered frame, and validates:
  1. No node overlaps another node in the same column
  2. All gaps between adjacent nodes in each column are uniform (CANVAS_NODE_GAP)
  3. Prints PASS/FAIL with details on every violation

Usage:
    python3 tsz/tests/validate_canvas_runtime.py

Requires: storybook compiled (zig build app) with CANVAS_DUMP support in engine.zig.
"""

import os
import re
import subprocess
import sys
from collections import defaultdict

CANVAS_NODE_GAP = 30.0
GAP_TOLERANCE = 2.0  # allow +/- 2px for float rounding
APP_BINARY = "zig-out/bin/zigos-app"

def compile_storybook():
    """Compile the storybook .tsz to generated_app.zig."""
    print("[1/3] Compiling storybook...")
    r = subprocess.run(
        ["./zig-out/bin/zigos-compiler", "build", "carts/storybook/Storybook.tsz"],
        capture_output=True, text=True, timeout=30,
    )
    if r.returncode != 0:
        # Check for errors (not just warnings)
        for line in r.stderr.splitlines():
            if "error" in line.lower() and "warning" not in line.lower():
                print(f"COMPILE ERROR: {line}")
                return False
    print("  Compiled OK")
    return True


def build_app():
    """Build the Zig binary."""
    print("[2/3] Building app binary...")
    r = subprocess.run(
        ["zig", "build", "app"],
        capture_output=True, text=True, timeout=120,
    )
    if r.returncode != 0:
        for line in r.stderr.splitlines():
            if "error:" in line:
                print(f"BUILD ERROR: {line}")
        return False
    print("  Built OK")
    return True


def run_and_capture():
    """Run the app with CANVAS_DUMP=1 and capture the dump from stderr."""
    print("[3/3] Running app with CANVAS_DUMP=1...")
    env = os.environ.copy()
    env["CANVAS_DUMP"] = "1"
    # SDL needs a display; use offscreen if available
    if "DISPLAY" not in env and "WAYLAND_DISPLAY" not in env:
        env["SDL_VIDEODRIVER"] = "dummy"

    try:
        r = subprocess.run(
            ["./" + APP_BINARY],
            capture_output=True, text=True, timeout=10, env=env,
        )
    except subprocess.TimeoutExpired:
        print("  App timed out (no CANVAS_DUMP output?)")
        return None

    # Parse dump from stderr
    lines = r.stderr.splitlines()
    in_dump = False
    nodes = []
    for line in lines:
        if "CANVAS_DUMP_START" in line:
            in_dump = True
            continue
        if "CANVAS_DUMP_END" in line:
            in_dump = False
            continue
        if in_dump:
            m = re.match(
                r"NODE (\d+) gx=(-?[\d.]+) gy=(-?[\d.]+) gw=([\d.]+) gh=([\d.]+) "
                r"computed_w=([\d.]+) computed_h=([\d.]+)",
                line,
            )
            if m:
                nodes.append({
                    "idx": int(m.group(1)),
                    "gx": float(m.group(2)),
                    "gy": float(m.group(3)),
                    "gw": float(m.group(4)),
                    "gh": float(m.group(5)),
                    "computed_w": float(m.group(6)),
                    "computed_h": float(m.group(7)),
                })

    if not nodes:
        print("  No canvas nodes found in dump!")
        print("  stderr output:")
        for line in lines[:30]:
            print(f"    {line}")
        return None

    print(f"  Captured {len(nodes)} canvas nodes")
    return nodes


def validate(nodes):
    """Validate no overlaps and uniform gaps."""
    errors = []
    warnings = []

    # Group by column (gx)
    columns = defaultdict(list)
    for node in nodes:
        columns[node["gx"]].append(node)

    print()
    print("=" * 60)
    print("CANVAS LAYOUT VALIDATION")
    print("=" * 60)

    for gx in sorted(columns.keys()):
        tiles = sorted(columns[gx], key=lambda t: t["gy"])
        print(f"\nColumn gx={gx:.0f}: {len(tiles)} tiles")

        for i, tile in enumerate(tiles):
            # gy is center, gh is height -> top = gy - gh/2, bottom = gy + gh/2
            top = tile["gy"] - tile["gh"] / 2
            bottom = tile["gy"] + tile["gh"] / 2
            print(f"  [{tile['idx']:3d}] gy={tile['gy']:7.0f}  gh={tile['gh']:5.0f}  "
                  f"top={top:7.0f}  bottom={bottom:7.0f}  "
                  f"(computed {tile['computed_w']:.0f}x{tile['computed_h']:.0f})")

            if i > 0:
                prev = tiles[i - 1]
                prev_bottom = prev["gy"] + prev["gh"] / 2
                this_top = tile["gy"] - tile["gh"] / 2
                gap = this_top - prev_bottom

                if gap < 0:
                    msg = (f"  *** OVERLAP: column gx={gx:.0f}, "
                           f"node {prev['idx']} (bottom={prev_bottom:.0f}) overlaps "
                           f"node {tile['idx']} (top={this_top:.0f}) by {-gap:.0f}px")
                    print(msg)
                    errors.append(msg)
                elif abs(gap - CANVAS_NODE_GAP) > GAP_TOLERANCE:
                    msg = (f"  *** BAD GAP: column gx={gx:.0f}, "
                           f"between node {prev['idx']} and node {tile['idx']}: "
                           f"gap={gap:.0f}px (expected {CANVAS_NODE_GAP:.0f}px)")
                    print(msg)
                    errors.append(msg)
                else:
                    print(f"         gap={gap:.0f}px OK")

    print()
    print("=" * 60)
    print(f"Total: {len(nodes)} nodes in {len(columns)} columns")
    print(f"Errors: {len(errors)}")

    if errors:
        print()
        print("FAIL — violations found:")
        for e in errors:
            print(f"  {e}")
        print()
        print("RESULT: FAIL")
        return False
    else:
        print()
        print("RESULT: PASS — all gaps uniform, no overlaps")
        return True


def main():
    os.chdir(os.path.join(os.path.dirname(__file__), ".."))

    if not compile_storybook():
        sys.exit(2)

    if not build_app():
        sys.exit(2)

    nodes = run_and_capture()
    if nodes is None:
        sys.exit(2)

    ok = validate(nodes)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
