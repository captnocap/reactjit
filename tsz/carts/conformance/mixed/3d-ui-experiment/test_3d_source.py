#!/usr/bin/env python3
"""Source-level validation for 3D UI experiment.

Parses .tsz source files directly — no compilation needed, no race with
other sessions on generated_app.zig. Validates spatial layout, color
assignments, structural intent, and visual hierarchy from the source.

Usage: python3 tsz/carts/3d-ui-experiment/test_3d_source.py
"""

import re
import sys
import os

PASS = 0
FAIL = 0

def ok(msg):
    global PASS; PASS += 1; print(f"  PASS: {msg}")

def fail(msg):
    global FAIL; FAIL += 1; print(f"  FAIL: {msg}")

def check(cond, pass_msg, fail_msg):
    ok(pass_msg) if cond else fail(fail_msg)

def parse_3d_elements(source):
    """Extract 3D.Mesh, 3D.Camera, 3D.Light elements from .tsz source."""
    meshes, cameras, lights = [], [], []
    # Join continuation lines: if a line ends without /> it continues
    lines = source.split('\n')
    joined = []
    buf = ''
    for line in lines:
        s = line.strip()
        if ('<3D.' in s or '&& <3D.' in s) or (buf and '/>' not in buf):
            buf += ' ' + s
            if '/>' in s:
                joined.append(buf.strip())
                buf = ''
        else:
            if buf:
                joined.append(buf.strip())
                buf = ''
            joined.append(s)
    if buf:
        joined.append(buf.strip())

    for stripped in joined:
        if '<3D.Mesh' in stripped:
            m = {}
            m['geo'] = (re.search(r'geometry="(\w+)"', stripped) or type('',(),{'group':lambda s,x:None})()).group(1)
            for prop in ['position', 'size', 'rotation']:
                match = re.search(rf'{prop}=\{{\[([0-9., -]+)\]}}', stripped)
                if match:
                    m[prop] = [float(x.strip()) for x in match.group(1).split(',')]
            rm = re.search(r'radius=\{([0-9.]+)\}', stripped)
            if rm: m['radius'] = float(rm.group(1))
            cm = re.search(r'color="(#[0-9a-fA-F]+)"', stripped)
            if cm: m['color'] = cm.group(1)
            # Handle ternary colors
            ct = re.search(r"color=\{.*\? '(#[0-9a-fA-F]+)' : '(#[0-9a-fA-F]+)'", stripped)
            if ct: m['color_true'] = ct.group(1); m['color_false'] = ct.group(2)
            m['conditional'] = '&&' in stripped
            meshes.append(m)
        elif '<3D.Camera' in stripped:
            c = {}
            for prop in ['position', 'lookAt']:
                match = re.search(rf'{prop}=\{{\[([0-9., -]+)\]}}', stripped)
                if match: c[prop] = [float(x.strip()) for x in match.group(1).split(',')]
            fm = re.search(r'fov=\{{(\d+)}}', stripped)
            if fm: c['fov'] = int(fm.group(1))
            c['conditional'] = '&&' in stripped
            cameras.append(c)
        elif '<3D.Light' in stripped:
            l = {}
            tm = re.search(r'type="(\w+)"', stripped)
            if tm: l['type'] = tm.group(1)
            im = re.search(r'intensity=\{{([0-9.]+)}}', stripped)
            if im: l['intensity'] = float(im.group(1))
            cm = re.search(r'color="(#[0-9a-fA-F]+)"', stripped)
            if cm: l['color'] = cm.group(1)
            l['conditional'] = '&&' in stripped
            lights.append(l)
    return meshes, cameras, lights

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def has_comment_in_scene3d(source):
    """Check for JSX comments inside Scene3D blocks."""
    in_scene = False
    leaks = []
    for line in source.split('\n'):
        s = line.strip()
        if '<Scene3D' in s: in_scene = True
        if '</Scene3D' in s: in_scene = False
        if in_scene and re.match(r'^\{/\*.*\*/\}$', s):
            leaks.append(s)
    return leaks

os.chdir(os.popen('git rev-parse --show-toplevel').read().strip())

# ══════════════════════════════════════════════════════════════════
# TASKBOARD
# ══════════════════════════════════════════════════════════════════

print("=== Taskboard: Source Validation ===\n")
with open('tsz/carts/3d-ui-experiment/taskboard.tsz') as f:
    tb_src = f.read()
tb_m, tb_c, tb_l = parse_3d_elements(tb_src)

print("[T1] Three columns at x=-6, x=0, x=6")
left = [m for m in tb_m if m.get('position') and -8 < m['position'][0] < -3]
mid = [m for m in tb_m if m.get('position') and -2 < m['position'][0] < 2]
right = [m for m in tb_m if m.get('position') and 3 < m['position'][0] < 8]
check(len(left) >= 8 and len(mid) >= 8 and len(right) >= 7,
      f"L:{len(left)} M:{len(mid)} R:{len(right)} meshes",
      f"Sparse: L:{len(left)} M:{len(mid)} R:{len(right)}")

print("[T2] Cards stack vertically (Y decreases)")
left_cards = sorted([m for m in left if m.get('geo') == 'box' and m.get('size') and m['size'][1] > 0.8],
                    key=lambda m: -m['position'][1])
check(len(left_cards) >= 3, f"{len(left_cards)} stacked cards in Todo", "Too few cards")
if len(left_cards) >= 2:
    check(left_cards[0]['position'][1] > left_cards[-1]['position'][1],
          f"Top Y={left_cards[0]['position'][1]} > Bot Y={left_cards[-1]['position'][1]}",
          "Cards not stacking")

print("[T3] Active card pops forward (Z > 0.3)")
active_pop = [m for m in mid if m.get('position') and m['position'][2] > 0.3
              and m.get('size') and m['size'][2] > 0.15]
check(len(active_pop) >= 1,
      f"Active card at Z={active_pop[0]['position'][2]}" if active_pop else "",
      "No popped card")

print("[T4] Done cards recessed (Z < 0)")
done_recessed = [m for m in right if m.get('position') and m['position'][2] < 0
                 and m.get('geo') == 'box' and m.get('size') and m['size'][1] >= 0.8]
check(len(done_recessed) >= 3, f"{len(done_recessed)} recessed done cards", "Too few recessed")

print("[T5] Priority spheres: red, yellow, green")
todo_spheres = [m for m in left if m.get('geo') == 'sphere' and m.get('color')]
colors = set()
for s in todo_spheres:
    r, g, b = hex_to_rgb(s['color'])
    if r > 200 and g < 100: colors.add('red')
    elif r > 180 and g > 100 and b < 80: colors.add('yellow')
    elif g > 140 and r < 100: colors.add('green')
check(len(colors) >= 3, f"Priority: {colors}", f"Missing: {colors}")

print("[T6] Green checkmarks on done cards")
done_spheres = [m for m in right if m.get('geo') == 'sphere' and m.get('color')]
green_checks = [s for s in done_spheres if hex_to_rgb(s['color'])[1] > 140]
check(len(green_checks) >= 4, f"{len(green_checks)} green dots", f"Only {len(green_checks)}")

print("[T7] 4+ camera presets, all distinct")
check(len(tb_c) >= 4, f"{len(tb_c)} cameras", "Not enough cameras")
if len(tb_c) >= 4:
    positions = [tuple(c.get('position', [])) for c in tb_c]
    check(len(set(positions)) == len(positions), "All unique positions", "Duplicate cameras")
    high = any(c.get('position', [0,0,0])[1] > 12 for c in tb_c)
    check(high, "Has overhead view (Y>12)", "No overhead")

print("[T8] Three-point lighting")
ambient = [l for l in tb_l if l.get('type') == 'ambient']
directional = [l for l in tb_l if l.get('type') == 'directional']
check(len(ambient) >= 1, f"Ambient at {ambient[0].get('intensity', '?')}" if ambient else "", "No ambient")
check(len(directional) >= 2, f"{len(directional)} directional (key+fill)", "Missing fill")

print("[T9] Column headers aligned at same Y")
headers = [m for m in tb_m if m.get('geo') == 'box' and m.get('size') and m['size'][0] > 3.5
           and m['size'][1] < 0.5 and m.get('position') and m['position'][1] > 6]
check(len(headers) >= 3, f"{len(headers)} headers", "Missing headers")
if len(headers) >= 3:
    ys = [h['position'][1] for h in headers]
    check(max(ys) - min(ys) < 0.5, f"Aligned: Y=[{min(ys):.1f},{max(ys):.1f}]", "Misaligned")

print("[T10] Back panels (Z < 0, tall)")
panels = [m for m in tb_m if m.get('geo') == 'box' and m.get('size') and m['size'][1] > 5
          and m.get('position') and m['position'][2] < 0]
check(len(panels) >= 3, f"{len(panels)} back panels", f"Only {len(panels)}")

print("[T11] Skeleton text lines")
text_lines = [m for m in tb_m if m.get('geo') == 'box' and m.get('size') and m['size'][1] <= 0.1
              and m['size'][0] > 0.8 and m['size'][2] < 0.05]
check(len(text_lines) >= 5, f"{len(text_lines)} skeleton lines", f"Only {len(text_lines)}")

print("[T12] FAB torus")
toruses = [m for m in tb_m if m.get('geo') == 'torus']
check(len(toruses) >= 1, "Torus FAB found", "No torus")

print("[T13] Viewport 1000x650")
check('width: 1000, height: 650' in tb_src, "1000x650", "Wrong size")

print("[T14] No comments inside Scene3D")
leaks = has_comment_in_scene3d(tb_src)
check(len(leaks) == 0, "Clean", f"Leaks: {leaks[:3]}")

print("[T15] Dual view modes (2 Scene3D)")
scene_count = tb_src.count('<Scene3D')
check(scene_count >= 2, f"{scene_count} Scene3D viewports", "Only 1 viewport")

# ══════════════════════════════════════════════════════════════════
# DASHBOARD
# ══════════════════════════════════════════════════════════════════

print("\n=== Dashboard: Source Validation ===\n")
with open('tsz/carts/3d-ui-experiment/dashboard.tsz') as f:
    db_src = f.read()
db_m, db_c, db_l = parse_3d_elements(db_src)

print("[D1] 7 bars per dataset (21 total)")
bars = [m for m in db_m if m.get('geo') == 'box' and m.get('size')
        and abs(m['size'][0] - 0.8) < 0.01 and abs(m['size'][2] - 0.8) < 0.01]
check(len(bars) >= 21, f"{len(bars)} chart bars", f"Only {len(bars)}")

print("[D2] Even bar spacing (1.5 units)")
if bars:
    xs = sorted(set(m['position'][0] for m in bars if m.get('position')))
    if len(xs) >= 7:
        gaps = [round(xs[i+1] - xs[i], 2) for i in range(len(xs)-1)]
        check(all(abs(g - 1.5) < 0.05 for g in gaps), f"Spacing: {gaps[0]}", f"Irregular: {gaps}")

print("[D3] Bar heights vary")
heights = set(m['size'][1] for m in bars if m.get('size'))
check(len(heights) >= 10, f"{len(heights)} distinct heights", f"Only {len(heights)}")

print("[D4] Three color palettes")
purple = [m for m in bars if m.get('color') and hex_to_rgb(m['color'])[2] > 150]
green = [m for m in bars if m.get('color') and hex_to_rgb(m['color'])[1] > 150 and hex_to_rgb(m['color'])[0] < 200]
red = [m for m in bars if m.get('color') and hex_to_rgb(m['color'])[0] > 200 and hex_to_rgb(m['color'])[1] < 170]
check(len(purple) >= 7, f"{len(purple)} purple", f"Only {len(purple)}")
check(len(green) >= 7, f"{len(green)} green", f"Only {len(green)}")
check(len(red) >= 7, f"{len(red)} red", f"Only {len(red)}")

print("[D5] Grid lines")
grid = [m for m in db_m if m.get('geo') == 'box' and m.get('size') and m['size'][0] >= 16
        and m['size'][1] < 0.02]
check(len(grid) >= 5, f"{len(grid)} grid lines", f"Only {len(grid)}")

print("[D6] Status orb (radius > 1)")
orbs = [m for m in db_m if m.get('geo') == 'sphere' and m.get('radius') and m['radius'] >= 1.0]
check(len(orbs) >= 1, f"Orb r={orbs[0]['radius']}" if orbs else "", "No orb")

print("[D7] Orbit torus")
db_torus = [m for m in db_m if m.get('geo') == 'torus']
check(len(db_torus) >= 1, "Orbit ring found", "No orbit torus")

print("[D8] Two Scene3D viewports")
db_scenes = db_src.count('<Scene3D')
check(db_scenes >= 2, f"{db_scenes} viewports", "Only 1")

print("[D9] Two cameras (main + mini)")
check(len(db_c) >= 2, f"{len(db_c)} cameras", "Only 1 camera")

print("[D10] No comments inside Scene3D")
db_leaks = has_comment_in_scene3d(db_src)
check(len(db_leaks) == 0, "Clean", f"Leaks: {db_leaks[:3]}")

# ══════════════════════════════════════════════════════════════════
# TERMINAL 3D
# ══════════════════════════════════════════════════════════════════

print("\n=== Terminal3D: Source Validation ===\n")
with open('tsz/carts/3d-ui-experiment/terminal3d.tsz') as f:
    tr_src = f.read()
tr_m, tr_c, tr_l = parse_3d_elements(tr_src)

print("[R1] Monitor screen (large flat box)")
screens = [m for m in tr_m if m.get('geo') == 'box' and m.get('size') and m['size'][0] > 4
           and m['size'][2] < 0.1 and m.get('position') and m['position'][2] < 0]
check(len(screens) >= 1, "Screen found", "No screen")

print("[R2] Bezel frame (4 edges)")
bezel = [m for m in tr_m if m.get('geo') == 'box' and m.get('position')
         and abs(m['position'][2] - (-0.8)) < 0.05
         and m.get('size') and ((m['size'][0] > 4 and m['size'][1] < 0.3)
                                or (m['size'][1] > 3 and m['size'][0] < 0.3))]
check(len(bezel) >= 4, f"{len(bezel)} bezel pieces", f"Only {len(bezel)}")

print("[R3] Terminal text lines (8+)")
term_lines = [m for m in tr_m if m.get('geo') == 'box' and m.get('size')
              and m['size'][1] < 0.1 and m['size'][0] > 0.8
              and m.get('position') and abs(m['position'][2] - (-0.68)) < 0.05]
check(len(term_lines) >= 8, f"{len(term_lines)} text lines", f"Only {len(term_lines)}")

print("[R4] Desk surface")
desk = [m for m in tr_m if m.get('geo') == 'box' and m.get('size')
        and m['size'][0] > 5 and m['size'][2] > 2]
check(len(desk) >= 1, "Desk found", "No desk")

print("[R5] Monitor stand (cylinder)")
stands = [m for m in tr_m if m.get('geo') == 'cylinder']
check(len(stands) >= 1, "Stand found", "No stand")

print("[R6] 3 themed directional lights")
dir_lights = [l for l in tr_l if l.get('type') == 'directional']
check(len(dir_lights) >= 3, f"{len(dir_lights)} themed lights", f"Only {len(dir_lights)}")

print("[R7] 4 camera presets")
check(len(tr_c) >= 4, f"{len(tr_c)} cameras", f"Only {len(tr_c)}")

print("[R8] Status LED sphere")
leds = [m for m in tr_m if m.get('geo') == 'sphere' and m.get('radius') and m['radius'] < 0.2
        and (m.get('color') or m.get('color_true'))]
check(len(leds) >= 1, "LED found", "No LED")

print("[R9] Desk accessories (keyboard + pen)")
kbd = [m for m in tr_m if m.get('geo') == 'box' and m.get('position')
       and m['position'][0] < -2 and 0.8 < m['position'][1] < 1.3]
pen = [m for m in tr_m if m.get('geo') == 'cylinder' and m.get('position')
       and m['position'][0] > 2 and m.get('size') and m['size'][1] < 1]
check(len(kbd) >= 1 and len(pen) >= 1, f"kbd={len(kbd)} pen={len(pen)}", f"kbd={len(kbd)} pen={len(pen)}")

print("[R10] Viewport 900x600")
check('width: 900, height: 600' in tr_src, "900x600", "Wrong size")

print("[R11] No comments inside Scene3D")
tr_leaks = has_comment_in_scene3d(tr_src)
check(len(tr_leaks) == 0, "Clean", f"Leaks: {tr_leaks[:3]}")

# ══════════════════════════════════════════════════════════════════
# CROSS-APP
# ══════════════════════════════════════════════════════════════════

print("\n=== Cross-App Validation ===\n")

print("[X1] All apps have ground planes")
tb_planes = [m for m in tb_m if m.get('geo') == 'plane']
db_planes = [m for m in db_m if m.get('geo') == 'plane']
tr_planes = [m for m in tr_m if m.get('geo') == 'plane']
check(len(tb_planes) >= 1 and len(db_planes) >= 1 and len(tr_planes) >= 1,
      f"TB:{len(tb_planes)} DB:{len(db_planes)} TR:{len(tr_planes)}", "Missing plane")

print("[X2] All meshes above ground (Y >= 0)")
all_meshes = tb_m + db_m + tr_m
below = [m for m in all_meshes if m.get('position') and m['position'][1] < -0.1]
check(len(below) == 0, "All Y >= 0", f"{len(below)} below ground")

print("[X3] State variables (useState)")
tb_states = len(re.findall(r'const \[', tb_src))
db_states = len(re.findall(r'const \[', db_src))
tr_states = len(re.findall(r'const \[', tr_src))
check(tb_states >= 3 and db_states >= 3 and tr_states >= 2,
      f"TB:{tb_states} DB:{db_states} TR:{tr_states}", "Insufficient states")

print("[X4] Geometry diversity")
tb_geos = set(m['geo'] for m in tb_m if m.get('geo'))
db_geos = set(m['geo'] for m in db_m if m.get('geo'))
tr_geos = set(m['geo'] for m in tr_m if m.get('geo'))
check(len(tb_geos) >= 4 and len(db_geos) >= 4 and len(tr_geos) >= 3,
      f"TB:{tb_geos} DB:{db_geos} TR:{tr_geos}", "Low diversity")

print("[X5] Explicit viewport sizes (no flexGrow on Scene3D)")
for name, src in [('taskboard', tb_src), ('dashboard', db_src), ('terminal3d', tr_src)]:
    scene_lines = [l for l in src.split('\n') if '<Scene3D' in l]
    for sl in scene_lines:
        check('width:' in sl and 'height:' in sl,
              f"{name}: explicit dimensions", f"{name}: missing explicit size on Scene3D")

print("[X6] No duplicate camera positions within any app")
for name, cams in [('taskboard', tb_c), ('dashboard', db_c), ('terminal3d', tr_c)]:
    positions = [tuple(c.get('position', [])) for c in cams if c.get('position')]
    check(len(set(positions)) == len(positions), f"{name}: all unique", f"{name}: duplicates")

# ══════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════

print(f"\n=== Results: {PASS} passed, {FAIL} failed ===")
if FAIL == 0:
    print("ALL TESTS PASSED")
    sys.exit(0)
else:
    print("SOME TESTS FAILED")
    sys.exit(1)
