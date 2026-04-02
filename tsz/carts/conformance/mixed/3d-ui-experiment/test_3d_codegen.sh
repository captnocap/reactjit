#!/bin/bash
# test_3d_codegen.sh — Verify 3D UI experiment compiles correctly
# and the generated Zig contains expected 3D primitives.
# Run: bash tsz/carts/3d-ui-experiment/test_3d_codegen.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

COMPILER=tsz/zig-out/bin/tsz-full
SRC=tsz/carts/3d-ui-experiment/taskboard.tsz
GEN=tsz/generated_app.zig
SNAPSHOT=/tmp/3d_ui_test_snapshot.zig
PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

echo "=== 3D UI Codegen Tests ==="
echo ""

# ── Test 1: Compiler exists ──
echo "[1] Compiler binary"
if [ -x "$COMPILER" ]; then pass "tsz-full exists and is executable"
else fail "tsz-full not found at $COMPILER"; exit 1; fi

# ── Test 2: Source compiles without errors ──
echo "[2] Compilation"
# Use flock to prevent race with other sessions overwriting generated_app.zig
OUTPUT=$(flock /tmp/tsz_compile.lock $COMPILER build "$SRC" 2>&1; cp "$GEN" "$SNAPSHOT") || true
if echo "$OUTPUT" | grep -q "Build FAILED"; then
    fail "Compilation failed"
    echo "    $OUTPUT" | head -5
else
    pass "taskboard.tsz compiles"
fi

# ── Test 3: Generated Zig exists ──
echo "[3] Generated output"
if [ -f "$SNAPSHOT" ]; then pass "generated_app.zig snapshot captured"
else fail "generated_app.zig not found"; exit 1; fi

# ── Test 4: Scene3D container ──
echo "[4] Scene3D container"
if grep -q "\.scene3d = true" "$SNAPSHOT"; then pass "Scene3D node present"
else fail "No .scene3d = true in generated code"; fi

# ── Test 5: 3D Camera nodes ──
echo "[5] Camera nodes"
CAM_COUNT=$(grep -o "scene3d_camera = true" "$SNAPSHOT" | wc -l)
if [ "$CAM_COUNT" -ge 4 ]; then pass "$CAM_COUNT camera nodes (4+ for presets)"
else fail "Only $CAM_COUNT camera nodes (expected 4+)"; fi

# ── Test 6: 3D Light nodes ──
echo "[6] Light nodes"
LIGHT_COUNT=$(grep -o "scene3d_light = true" "$SNAPSHOT" | wc -l)
if [ "$LIGHT_COUNT" -ge 3 ]; then pass "$LIGHT_COUNT light nodes (ambient + directionals)"
else fail "Only $LIGHT_COUNT light nodes (expected 3+)"; fi

# ── Test 7: 3D Mesh nodes ──
echo "[7] Mesh nodes"
MESH_COUNT=$(grep -o "scene3d_mesh = true" "$SNAPSHOT" | wc -l)
if [ "$MESH_COUNT" -ge 25 ]; then pass "$MESH_COUNT mesh nodes"
else fail "Only $MESH_COUNT mesh nodes (expected 25+)"; fi

# ── Test 8: Geometry types used ──
echo "[8] Geometry variety"
GEOS_FOUND=0
for geo in box sphere plane cylinder cone torus; do
    if grep -q "scene3d_geometry = \"$geo\"" "$SNAPSHOT"; then
        GEOS_FOUND=$((GEOS_FOUND+1))
    else
        fail "Missing geometry: $geo"
    fi
done
if [ "$GEOS_FOUND" -eq 6 ]; then pass "All 6 geometry types present"; fi

# ── Test 9: State variables ──
echo "[9] State variables"
STATE_COUNT=$(grep -o "app_state_count.* return [0-9]*" "$SNAPSHOT" | grep -o "[0-9]*$" || echo "0")
if [ "$STATE_COUNT" -ge 3 ]; then pass "$STATE_COUNT state slots"
else fail "Expected 3+ state slots, got: $STATE_COUNT"; fi

# ── Test 10: FOV values ──
echo "[10] Camera FOV"
FOV_COUNT=$(grep -o "scene3d_fov = [0-9]*" "$SNAPSHOT" | sort -u | wc -l)
if [ "$FOV_COUNT" -ge 3 ]; then pass "$FOV_COUNT distinct FOV values"
else fail "Only $FOV_COUNT FOV values (expected 3+)"; fi

# ── Test 11: Light types ──
echo "[11] Light types"
if grep -q 'scene3d_light_type = "ambient"' "$SNAPSHOT" && grep -q 'scene3d_light_type = "directional"' "$SNAPSHOT"; then
    pass "Both ambient and directional lights"
else fail "Missing light types"; fi

# ── Test 12: Color variety ──
echo "[12] Color variety"
COLOR_COUNT=$(grep -o "text_color = Color.rgb([0-9, ]*)" "$SNAPSHOT" | sort -u | wc -l)
if [ "$COLOR_COUNT" -ge 8 ]; then pass "$COLOR_COUNT distinct colors"
else fail "Only $COLOR_COUNT colors (expected 8+)"; fi

# ── Test 13: Two Scene3D views (board + showcase) ──
echo "[13] Dual view modes"
SCENE_COUNT=$(grep -o "\.scene3d = true" "$SNAPSHOT" | wc -l)
if [ "$SCENE_COUNT" -ge 2 ]; then pass "$SCENE_COUNT Scene3D views"
else fail "Only $SCENE_COUNT Scene3D (expected 2)"; fi

# ── Test 14: Binary was produced ──
echo "[14] Binary output"
BIN=tsz/zig-out/bin/taskboard.app
if [ -x "$BIN" ]; then
    SIZE=$(stat -c%s "$BIN")
    pass "Binary: $((SIZE / 1048576))MB"
else fail "No binary at $BIN"; fi

# ── Test 15: Rotation values ──
echo "[15] 3D rotations"
if grep -q "scene3d_rot_y" "$SNAPSHOT"; then pass "Y-axis rotation present"
else fail "No rotation values"; fi

# ── Test 16: Position spread ──
echo "[16] Spatial distribution"
XPOS_COUNT=$(grep -o "scene3d_pos_x = [0-9.-]*" "$SNAPSHOT" | sort -u | wc -l)
if [ "$XPOS_COUNT" -ge 5 ]; then pass "$XPOS_COUNT unique X positions"
else fail "Only $XPOS_COUNT X positions (expected 5+)"; fi

# ── Cleanup ──
rm -f "$SNAPSHOT"

# ── Summary ──
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -eq 0 ]; then
    echo "ALL TESTS PASSED"
    exit 0
else
    echo "SOME TESTS FAILED"
    exit 1
fi
