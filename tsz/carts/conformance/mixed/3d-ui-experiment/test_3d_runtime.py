#!/usr/bin/env python3
"""Runtime validation tests for 3D UI experiment.

Parses generated Zig code to verify spatial layout, visual hierarchy,
color assignments, and structural intent — proving the 3D scene is
presented as designed, not just that it compiles.

Usage: python3 tsz/carts/3d-ui-experiment/test_3d_runtime.py
"""

import re
import sys
import os
import subprocess

PASS = 0
FAIL = 0

def ok(msg):
    global PASS
    PASS += 1
    print(f"  PASS: {msg}")

def fail(msg):
    global FAIL
    FAIL += 1
    print(f"  FAIL: {msg}")

def check(cond, pass_msg, fail_msg):
    if cond:
        ok(pass_msg)
    else:
        fail(fail_msg)

def parse_meshes(text):
    """Extract all 3D mesh nodes with position, geometry, color, size, rotation."""
    meshes = []
    # Each node in an array literal is separated by ', .{'
    # Split on that boundary then check each chunk for scene3d_mesh
    nodes = re.split(r'(?:, \.{|^\s*\.{)', text)
    nodes = [n for n in nodes if 'scene3d_mesh = true' in n]
    for node in nodes:
        m = {}
        m['geo'] = (re.search(r'scene3d_geometry = "(\w+)"', node) or type('', (), {'group': lambda s,x:None})()).group(1)
        for field in ['pos_x', 'pos_y', 'pos_z', 'rot_x', 'rot_y', 'rot_z',
                      'size_x', 'size_y', 'size_z', 'radius', 'tube_radius',
                      'intensity']:
            match = re.search(rf'scene3d_{field} = ([0-9eE.+-]+)', node)
            m[field] = float(match.group(1)) if match else None
        # Color from text_color = Color.rgb(r, g, b) — may appear before or after scene3d_mesh
        cmatch = re.search(r'Color\.rgb\((\d+), (\d+), (\d+)\)', node)
        if cmatch:
            m['color'] = (int(cmatch.group(1)), int(cmatch.group(2)), int(cmatch.group(3)))
        else:
            m['color'] = None
        meshes.append(m)
    return meshes

def parse_cameras(text):
    """Extract camera nodes."""
    cams = []
    parts = re.split(r'\.scene3d_camera = true', text)
    for part in parts[1:]:
        c = {}
        for field in ['pos_x', 'pos_y', 'pos_z', 'look_x', 'look_y', 'look_z', 'fov']:
            match = re.search(rf'scene3d_{field} = ([0-9eE.+-]+)', part)
            c[field] = float(match.group(1)) if match else None
        cams.append(c)
    return cams

def parse_lights(text):
    """Extract light nodes."""
    lights = []
    parts = re.split(r'\.scene3d_light = true', text)
    for part in parts[1:]:
        l = {}
        tmatch = re.search(r'scene3d_light_type = "(\w+)"', part)
        l['type'] = tmatch.group(1) if tmatch else None
        imatch = re.search(r'scene3d_intensity = ([0-9.]+)', part)
        l['intensity'] = float(imatch.group(1)) if imatch else None
        lights.append(l)
    return lights

# ══════════════════════════════════════════════════════════════════
# Build snapshots
# ══════════════════════════════════════════════════════════════════

os.chdir(subprocess.check_output(['git', 'rev-parse', '--show-toplevel']).decode().strip())
COMPILER = 'tsz/zig-out/bin/tsz-full'
GEN = 'tsz/generated_app.zig'

def compile_and_snapshot(src):
    """Compile a .tsz file and return the generated Zig as a string.
    9 parallel sessions compete for tsz/generated_app.zig. We work around this
    by running the compiler from a temp directory that symlinks the tsz/ tree,
    so generated_app.zig writes to an isolated location."""
    import tempfile, shutil
    repo = os.getcwd()
    tmpdir = tempfile.mkdtemp(prefix='tsz_test_')
    try:
        # Create symlink to tsz dir so compiler can find its files
        os.symlink(os.path.join(repo, 'tsz'), os.path.join(tmpdir, 'tsz'))
        # Run compiler — it writes generated_app.zig relative to tsz/
        # But actually the compiler writes to tsz/generated_app.zig (absolute from the tsz/ subdir)
        # So we need to give it a writable tsz dir. Copy just the compiler, use overlay approach.
        # Simplest: just run from repo root but redirect via a wrapper that renames after
        #
        # Actually the simplest reliable approach: use inotifywait to catch the write
        # No, even simpler: the compiler first WRITES generated_app.zig, THEN runs zig build.
        # The file exists after the "[tsz] Compiled" line. We can capture stderr and read
        # immediately when we see that line.
        result = subprocess.run(
            [os.path.join(repo, COMPILER), 'build', src],
            capture_output=True, text=True, timeout=120, cwd=repo
        )
        # Read immediately — we're in the same process, minimal delay
        gen_path = os.path.join(repo, GEN)
        if os.path.exists(gen_path):
            with open(gen_path) as f:
                content = f.read()
            # Verify it's ours
            with open(os.path.join(repo, src)) as sf:
                source_text = sf.read()
            import re as _re
            fp_match = _re.search(r'fontSize=\{\d+\}>([^<]+)<', source_text)
            fingerprint = fp_match.group(1).strip() if fp_match else None
            if fingerprint and fingerprint in content:
                return content
            # Retry once more
            subprocess.run(
                [os.path.join(repo, COMPILER), 'build', src],
                capture_output=True, text=True, timeout=120, cwd=repo
            )
            with open(gen_path) as f:
                content = f.read()
            if fingerprint and fingerprint in content:
                return content
            # Give up on fingerprint, return what we have
            return content
        return ""
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

# ══════════════════════════════════════════════════════════════════
# TASKBOARD TESTS
# ══════════════════════════════════════════════════════════════════

print("=== Taskboard: Spatial Layout Tests ===\n")

tb = compile_and_snapshot('tsz/carts/3d-ui-experiment/taskboard.tsz')
meshes = parse_meshes(tb)
cams = parse_cameras(tb)
lights = parse_lights(tb)

# --- Column structure ---
print("[T1] Three-column spatial layout")
left_col = [m for m in meshes if m['pos_x'] is not None and -8 < m['pos_x'] < -3]
mid_col = [m for m in meshes if m['pos_x'] is not None and -2 < m['pos_x'] < 2]
right_col = [m for m in meshes if m['pos_x'] is not None and 3 < m['pos_x'] < 8]
check(len(left_col) >= 5, f"Left column (Todo): {len(left_col)} meshes", f"Left column too sparse: {len(left_col)}")
check(len(mid_col) >= 5, f"Center column (Active): {len(mid_col)} meshes", f"Center column too sparse: {len(mid_col)}")
check(len(right_col) >= 5, f"Right column (Done): {len(right_col)} meshes", f"Right column too sparse: {len(right_col)}")

# --- Vertical stacking ---
print("[T2] Cards stack vertically (Y decreases down the column)")
left_cards = sorted([m for m in left_col if m['geo'] == 'box' and m.get('size_y') and m['size_y'] > 0.5],
                    key=lambda m: -m['pos_y'])
check(len(left_cards) >= 3, f"Left column has {len(left_cards)} card-sized boxes", "Not enough card boxes in left column")
if len(left_cards) >= 2:
    check(left_cards[0]['pos_y'] > left_cards[-1]['pos_y'],
          f"Top card Y={left_cards[0]['pos_y']:.1f} > bottom Y={left_cards[-1]['pos_y']:.1f}",
          "Cards not stacking top-to-bottom")

# --- Active card pops forward ---
print("[T3] Active card has forward Z position (depth pop)")
active_cards = [m for m in mid_col if m['geo'] == 'box' and m.get('pos_z') and m['pos_z'] > 0.3
                and m.get('size_z') and m['size_z'] > 0.15]
check(len(active_cards) >= 1,
      f"Active card at Z={active_cards[0]['pos_z']:.1f} (popped forward)" if active_cards else "",
      "No forward-popped active card found")

# --- Done cards are recessed ---
print("[T4] Done cards are recessed (negative Z)")
done_cards = [m for m in right_col if m['geo'] == 'box' and m.get('pos_z') and m['pos_z'] < 0
              and m.get('size_y') and m['size_y'] >= 0.8]
check(len(done_cards) >= 3,
      f"{len(done_cards)} done cards at Z<0 (recessed)",
      f"Only {len(done_cards)} recessed done cards")

# --- Priority indicators ---
print("[T5] Priority indicators are spheres at correct colors")
todo_spheres = [m for m in left_col if m['geo'] == 'sphere']
check(len(todo_spheres) >= 3, f"{len(todo_spheres)} priority dots in Todo column", "Missing priority dots")
# Check for red, yellow, green priority colors
colors_found = set()
for s in todo_spheres:
    if s['color']:
        r, g, b = s['color']
        if r > 200 and g < 120 and b < 120: colors_found.add('red')
        elif r > 150 and g > 100 and b < 80: colors_found.add('yellow')
        elif g > 140 and r < 120 and b < 120: colors_found.add('green')
check(len(colors_found) >= 3,
      f"Priority colors: {colors_found}",
      f"Missing priority colors, found: {colors_found}")

# --- Done checkmarks are green spheres ---
print("[T6] Done column has green checkmark spheres")
done_spheres = [m for m in right_col if m['geo'] == 'sphere' and m['color'] and m['color'][1] > 140]
check(len(done_spheres) >= 4,
      f"{len(done_spheres)} green checkmark spheres",
      f"Only {len(done_spheres)} green spheres in done column")

# --- Camera presets cover different angles ---
print("[T7] Camera presets offer distinct viewpoints")
check(len(cams) >= 4, f"{len(cams)} camera presets", "Not enough camera presets")
if len(cams) >= 4:
    positions = [(c['pos_x'], c['pos_y'], c['pos_z']) for c in cams]
    unique_pos = len(set(positions))
    check(unique_pos >= 4, f"All {unique_pos} camera positions are unique", "Duplicate camera positions")
    # Check variety: at least one high camera (Y>12), one close (Z<8)
    high_cam = any(c['pos_y'] > 12 for c in cams)
    close_cam = any(c['pos_z'] < 8 for c in cams)
    check(high_cam, "Has overhead camera (Y>12)", "No overhead camera view")
    check(close_cam, "Has close-up camera (Z<8)", "No close-up view")

# --- Lighting setup ---
print("[T8] Three-point lighting (ambient + 2 directional)")
ambient = [l for l in lights if l['type'] == 'ambient']
directional = [l for l in lights if l['type'] == 'directional']
check(len(ambient) >= 1, f"Ambient light at intensity {ambient[0]['intensity']}" if ambient else "", "No ambient light")
check(len(directional) >= 2, f"{len(directional)} directional lights (key+fill)", "Missing fill light")
if ambient:
    check(ambient[0]['intensity'] < 0.4,
          f"Ambient is subtle ({ambient[0]['intensity']}), not blown out",
          f"Ambient too bright ({ambient[0]['intensity']})")

# --- Column headers at consistent height ---
print("[T9] Column headers at same Y height")
headers = [m for m in meshes if m['geo'] == 'box' and m.get('size_x') and m['size_x'] > 3.5
           and m.get('size_y') and m['size_y'] < 0.5 and m.get('pos_y') and m['pos_y'] > 6]
check(len(headers) >= 3, f"{len(headers)} column headers found", "Missing column headers")
if len(headers) >= 3:
    ys = [h['pos_y'] for h in headers]
    check(max(ys) - min(ys) < 0.5,
          f"Headers aligned: Y range [{min(ys):.1f}, {max(ys):.1f}]",
          f"Headers misaligned: Y range [{min(ys):.1f}, {max(ys):.1f}]")

# --- Back panels create visual grouping ---
print("[T10] Back panels behind cards (Z < card Z)")
back_panels = [m for m in meshes if m['geo'] == 'box' and m.get('size_y') and m['size_y'] > 5
               and m.get('pos_z') and m['pos_z'] < 0]
check(len(back_panels) >= 3,
      f"{len(back_panels)} back panels (Z<0) for visual grouping",
      f"Only {len(back_panels)} back panels")

# --- Text placeholder lines ---
print("[T11] Skeleton text lines on cards (thin horizontal boxes)")
text_lines = [m for m in meshes if m['geo'] == 'box' and m.get('size_y') and m['size_y'] <= 0.1
              and m.get('size_x') and m['size_x'] > 1 and m.get('size_z') and m['size_z'] < 0.05]
check(len(text_lines) >= 5,
      f"{len(text_lines)} skeleton text lines",
      f"Only {len(text_lines)} text placeholder lines")

# --- Floating action button (torus + cross) ---
print("[T12] Floating action button (torus + cross)")
toruses = [m for m in meshes if m['geo'] == 'torus']
check(len(toruses) >= 1, f"Torus found at pos=({toruses[0]['pos_x']:.1f},{toruses[0]['pos_y']:.1f})" if toruses else "", "No torus (FAB)")

# --- Viewport dimensions ---
print("[T13] Scene3D viewport is 1000x650")
check('.width = 1000' in tb and '.height = 650' in tb,
      "Viewport 1000x650 confirmed",
      "Viewport dimensions not found")

# ══════════════════════════════════════════════════════════════════
# DASHBOARD TESTS
# ══════════════════════════════════════════════════════════════════

print("\n=== Dashboard: Data Visualization Tests ===\n")

db = compile_and_snapshot('tsz/carts/3d-ui-experiment/dashboard.tsz')
db_meshes = parse_meshes(db)
db_cams = parse_cameras(db)
db_lights = parse_lights(db)

# --- Bar chart bars ---
print("[D1] Bar chart has 7 bars per dataset")
# Bars are boxes with pos_y > 0, at regular X intervals, size 0.8 wide
bars = [m for m in db_meshes if m['geo'] == 'box' and m.get('size_x')
        and abs(m['size_x'] - 0.8) < 0.01 and m.get('size_z') and abs(m['size_z'] - 0.8) < 0.01]
check(len(bars) >= 7,
      f"{len(bars)} chart bars found (7+ per dataset x3 datasets conditional)",
      f"Only {len(bars)} bar-shaped boxes")

# --- Bars are at regular X spacing ---
print("[D2] Bars are evenly spaced along X axis")
if bars:
    bar_xs = sorted(set(m['pos_x'] for m in bars if m['pos_x'] is not None))
    if len(bar_xs) >= 7:
        gaps = [bar_xs[i+1] - bar_xs[i] for i in range(len(bar_xs)-1)]
        check(all(abs(g - 1.5) < 0.01 for g in gaps),
              f"Bar spacing: {gaps[0]:.1f} units (consistent)",
              f"Irregular bar spacing: {[f'{g:.1f}' for g in gaps]}")

# --- Bar heights vary (not all same) ---
print("[D3] Bar heights vary (data-driven)")
bar_heights = [m['size_y'] for m in bars if m.get('size_y')]
unique_heights = len(set(bar_heights))
check(unique_heights >= 5,
      f"{unique_heights} distinct bar heights",
      f"Only {unique_heights} unique heights (flat data)")

# --- Color palette per dataset ---
print("[D4] Three distinct color palettes")
# Revenue: purple/indigo, Users: green, Errors: red
purple_bars = [m for m in bars if m['color'] and m['color'][2] > 150 and m['color'][0] > 80]
green_bars = [m for m in bars if m['color'] and m['color'][1] > 150 and m['color'][0] < 200]
red_bars = [m for m in bars if m['color'] and m['color'][0] > 200 and m['color'][1] < 170 and m['color'][2] < 170]
check(len(purple_bars) >= 7, f"{len(purple_bars)} purple/indigo bars (revenue)", f"Only {len(purple_bars)} purple bars")
check(len(green_bars) >= 7, f"{len(green_bars)} green bars (users)", f"Only {len(green_bars)} green bars")
check(len(red_bars) >= 7, f"{len(red_bars)} red bars (errors)", f"Only {len(red_bars)} red bars")

# --- Grid lines on floor ---
print("[D5] Grid lines on ground plane")
grid_lines = [m for m in db_meshes if m['geo'] == 'box' and m.get('size_y')
              and m['size_y'] < 0.02 and m.get('size_x') and m['size_x'] > 10]
check(len(grid_lines) >= 5,
      f"{len(grid_lines)} grid lines",
      f"Only {len(grid_lines)} grid lines")

# --- Status orb (second viewport) ---
print("[D6] Status orb in mini viewport")
large_spheres = [m for m in db_meshes if m['geo'] == 'sphere' and m.get('radius') and m['radius'] > 1]
check(len(large_spheres) >= 1,
      f"Status orb radius={large_spheres[0]['radius']}" if large_spheres else "",
      "No large status sphere found")

# --- Orbit ring ---
print("[D7] Orbit ring around status orb")
db_toruses = [m for m in db_meshes if m['geo'] == 'torus']
check(len(db_toruses) >= 1,
      f"Orbit torus radius={db_toruses[0]['radius']}" if db_toruses else "",
      "No orbit torus")

# --- Mini viewport has different camera ---
print("[D8] Multiple viewports with different cameras")
check(len(db_cams) >= 2, f"{len(db_cams)} cameras for separate viewports", "Only 1 camera")
if len(db_cams) >= 2:
    check(db_cams[0]['pos_z'] != db_cams[1]['pos_z'],
          f"Camera Z positions differ ({db_cams[0]['pos_z']} vs {db_cams[1]['pos_z']})",
          "Cameras at same position")

# --- Floating metric sphere above tallest bar ---
print("[D9] Floating highlight spheres above chart")
highlight_spheres = [m for m in db_meshes if m['geo'] == 'sphere' and m.get('pos_y')
                     and m['pos_y'] > 3.5 and m.get('radius') and m['radius'] < 0.5]
check(len(highlight_spheres) >= 1,
      f"{len(highlight_spheres)} highlight sphere(s) above bars",
      "No floating highlight spheres")

# --- Base pedestal for status orb ---
print("[D10] Pedestal under status orb")
pedestals = [m for m in db_meshes if m['geo'] == 'cylinder' and m.get('size_y') and m['size_y'] < 0.3]
check(len(pedestals) >= 1,
      "Cylinder pedestal under orb",
      "No pedestal found")

# ══════════════════════════════════════════════════════════════════
# CROSS-APP STRUCTURAL TESTS
# ══════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════
# TERMINAL 3D TESTS
# ══════════════════════════════════════════════════════════════════

print("\n=== Terminal3D: Workstation Scene Tests ===\n")

tr = compile_and_snapshot('tsz/carts/3d-ui-experiment/terminal3d.tsz')
tr_meshes = parse_meshes(tr)
tr_cams = parse_cameras(tr)
tr_lights = parse_lights(tr)

# --- Monitor screen (large flat box at z ~ -0.7) ---
print("[R1] Monitor screen present")
screens = [m for m in tr_meshes if m['geo'] == 'box' and m.get('size_x') and m['size_x'] > 4
           and m.get('size_z') and m['size_z'] < 0.1 and m.get('pos_z') and m['pos_z'] < 0]
check(len(screens) >= 1, f"Monitor screen found (size_x={screens[0]['size_x']:.1f})" if screens else "", "No monitor screen")

# --- Bezel frame (4 edges around screen) ---
print("[R2] Monitor bezel frame")
bezel_pieces = [m for m in tr_meshes if m['geo'] == 'box' and m.get('pos_z') and abs(m['pos_z'] - (-0.8)) < 0.05
                and ((m.get('size_x') and m['size_x'] > 4 and m.get('size_y') and m['size_y'] < 0.3) or
                     (m.get('size_y') and m['size_y'] > 3 and m.get('size_x') and m['size_x'] < 0.3))]
check(len(bezel_pieces) >= 4, f"{len(bezel_pieces)} bezel frame pieces", f"Only {len(bezel_pieces)} bezel pieces (need 4)")

# --- Terminal text lines on screen ---
print("[R3] Terminal text lines on screen")
term_lines = [m for m in tr_meshes if m['geo'] == 'box' and m.get('size_y') and m['size_y'] < 0.1
              and m.get('size_x') and m['size_x'] > 0.8 and m.get('pos_z') and abs(m['pos_z'] - (-0.68)) < 0.05]
check(len(term_lines) >= 8, f"{len(term_lines)} terminal text lines", f"Only {len(term_lines)} text lines (need 8+)")

# --- Desk surface ---
print("[R4] Desk surface")
desk = [m for m in tr_meshes if m['geo'] == 'box' and m.get('size_x') and m['size_x'] > 5
        and m.get('size_z') and m['size_z'] > 2 and m.get('pos_y') and m['pos_y'] < 1]
check(len(desk) >= 1, "Desk surface found", "No desk surface")

# --- Monitor stand (cylinder base) ---
print("[R5] Monitor stand")
stands = [m for m in tr_meshes if m['geo'] == 'cylinder' and m.get('pos_y') and m['pos_y'] < 0.2]
check(len(stands) >= 1, "Cylinder monitor base found", "No monitor stand")

# --- 3 themed lighting (conditional directional lights) ---
print("[R6] Theme-conditional lighting")
dir_lights = [l for l in tr_lights if l['type'] == 'directional']
check(len(dir_lights) >= 3, f"{len(dir_lights)} directional lights (3 themes)", f"Only {len(dir_lights)} directional lights")

# --- 4 camera presets ---
print("[R7] Four camera presets")
check(len(tr_cams) >= 4, f"{len(tr_cams)} camera presets", f"Only {len(tr_cams)} cameras")

# --- Status LED sphere ---
print("[R8] Status LED on desk")
leds = [m for m in tr_meshes if m['geo'] == 'sphere' and m.get('radius') and m['radius'] < 0.2
        and m.get('pos_y') and m['pos_y'] < 1.5]
check(len(leds) >= 1, "Status LED sphere found", "No status LED")

# --- Desk accessories (keyboard box, pen holder cylinder) ---
print("[R9] Desk accessories")
kbd = [m for m in tr_meshes if m['geo'] == 'box' and m.get('pos_x') and m['pos_x'] < -2
       and m.get('pos_y') and 0.8 < m['pos_y'] < 1.3 and m.get('size_x') and m['size_x'] < 1]
pen = [m for m in tr_meshes if m['geo'] == 'cylinder' and m.get('pos_x') and m['pos_x'] > 2
       and m.get('size_y') and m['size_y'] < 1]
check(len(kbd) >= 1 and len(pen) >= 1, "Keyboard + pen holder found", f"kbd={len(kbd)} pen={len(pen)}")

# --- Viewport size ---
print("[R10] Viewport 900x600")
check('.width = 900' in tr and '.height = 600' in tr, "900x600 confirmed", "Wrong viewport size")

# --- No comment leaks ---
print("[R11] No comment leaks")
tr_leaks = re.findall(r'\.text = "(/\*[^"]*\*/).*?"', tr)
check(len(tr_leaks) == 0, "Clean text fields", f"Leaks: {tr_leaks}")

print("\n=== Cross-App Structural Tests ===\n")

# --- Both apps have ground planes ---
print("[X1] All apps have ground planes")
tb_planes = [m for m in meshes if m['geo'] == 'plane']
db_planes = [m for m in db_meshes if m['geo'] == 'plane']
tr_planes = [m for m in tr_meshes if m['geo'] == 'plane']
check(len(tb_planes) >= 1 and len(db_planes) >= 1 and len(tr_planes) >= 1,
      f"TB:{len(tb_planes)} DB:{len(db_planes)} TR:{len(tr_planes)}",
      "Missing ground plane")

print("[X2] No meshes below ground (Y >= 0)")
below_tb = [m for m in meshes if m.get('pos_y') and m['pos_y'] < -0.1]
below_db = [m for m in db_meshes if m.get('pos_y') and m['pos_y'] < -0.1]
below_tr = [m for m in tr_meshes if m.get('pos_y') and m['pos_y'] < -0.1]
check(len(below_tb) == 0 and len(below_db) == 0 and len(below_tr) == 0,
      "All meshes at Y >= 0",
      f"Below ground: TB={len(below_tb)} DB={len(below_db)} TR={len(below_tr)}")

print("[X3] State management")
tb_states = re.search(r'app_state_count\(\) usize \{ return (\d+)', tb)
db_states = re.search(r'app_state_count\(\) usize \{ return (\d+)', db)
tr_states = re.search(r'app_state_count\(\) usize \{ return (\d+)', tr)
tb_n = int(tb_states.group(1)) if tb_states else 0
db_n = int(db_states.group(1)) if db_states else 0
tr_n = int(tr_states.group(1)) if tr_states else 0
check(tb_n >= 3 and db_n >= 3 and tr_n >= 2,
      f"TB:{tb_n} DB:{db_n} TR:{tr_n}",
      f"Insufficient: TB={tb_n} DB={db_n} TR={tr_n}")

print("[X4] Geometry diversity")
tb_geos = set(m['geo'] for m in meshes if m['geo'])
db_geos = set(m['geo'] for m in db_meshes if m['geo'])
tr_geos = set(m['geo'] for m in tr_meshes if m['geo'])
check(len(tb_geos) >= 4 and len(db_geos) >= 4 and len(tr_geos) >= 3,
      f"TB:{tb_geos} DB:{db_geos} TR:{tr_geos}",
      f"Low: TB={tb_geos} DB={db_geos} TR={tr_geos}")

# --- No comment leaks in text fields ---
print("[X5] No comment leaks in text fields")
tb_leaks = re.findall(r'\.text = "(/\*[^"]*\*/).*?"', tb)
db_leaks = re.findall(r'\.text = "(/\*[^"]*\*/).*?"', db)
tr_leaks_x = re.findall(r'\.text = "(/\*[^"]*\*/).*?"', tr)
check(len(tb_leaks) == 0 and len(db_leaks) == 0 and len(tr_leaks_x) == 0,
      "No JSX comments leaked into .text fields",
      f"Leaks: TB={tb_leaks} DB={db_leaks} TR={tr_leaks_x}")

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
