# 3D UI Experiment Findings

## What Works Well

### Primitives as UI elements
- **box** — cards, panels, buttons, progress bars, dividers, grid lines
- **sphere** — status indicators, priority dots, data point markers
- **torus** — floating action buttons, orbit rings, decorative rings
- **cylinder** — progress bars (rotated 90deg), pedestals, bases
- **cone** — directional indicators
- **plane** — ground surfaces, backgrounds

### Depth as information hierarchy
- Active/selected items pop forward (z > 0), completed items recess (z < 0)
- Card thickness communicates importance (0.25 active vs 0.1 done)
- Back panels at z=-0.5 create visual grouping without borders

### Color + 3D = effective data viz
- 3D bar charts with conditional datasets work — state switches entire bar sets
- Floating spheres above bars work as data point highlights
- Color-coded columns with depth create strong visual hierarchy

### Multiple Scene3D viewports
- Side-by-side 3D viewports work (main chart + mini status orb)
- Each viewport has independent camera/lighting
- State changes affect both viewports simultaneously

### Conditional camera presets
- `{camPreset == N && <3D.Camera ... />}` pattern works reliably
- Different FOV values create zoom-in/zoom-out effect

## What's Missing (Framework Gaps)

### Critical for 3D UI
1. **3D.Text** — Cannot label anything in 3D space. Must use 2D overlay panels.
2. **Click raycasting** — Scene3D renders to texture. No way to click a 3D mesh.
3. **Per-mesh animation** — Only tree `animate`+`windSpeed` exists. No rotation, bob, pulse.
4. **Orbit camera** — No mouse drag/scroll camera control. Camera is fixed per frame.

### Nice to have
5. **3D.Group** — Hierarchical transforms for compound objects (listed as "not yet rendered")
6. **Transparency/opacity** — No alpha on meshes. Can't do glass panels or fading.
7. **Texture mapping** — Only solid colors. No images on 3D surfaces.
8. **Point lights** — Only ambient + directional. No positional glow effects.

## Patterns Discovered

### Hybrid 2D/3D layout
Best approach: 3D for spatial visualization, 2D panels alongside for text/interaction.
```
<Box flexDirection="row">
  <Scene3D ... />        <!-- spatial view -->
  <Box>                  <!-- 2D control panel -->
    <Text>Labels</Text>
    <Pressable>Buttons</Pressable>
  </Box>
</Box>
```

### State-driven 3D
Conditional rendering works: `{condition && <3D.Mesh ... />}`. Entire datasets can swap.
Ternary in color props works: `color={selected ? '#blue' : '#gray'}`.
Object property access does NOT work — must inline all values.

### "Text" in 3D
Use thin boxes as text placeholder lines: `size={[2.4, 0.08, 0.01]}` color="#8b949e"`.
Creates a convincing skeleton text effect on 3D cards.

### Scene3D sizing
Must use explicit `width`/`height`. `flexGrow: 1` renders as ~10px.
Viewport size directly maps to render target resolution.

## Apps Built

| App | Description | Primitives | Viewports |
|-----|-------------|------------|-----------|
| taskboard.tsz | 3D kanban board | box, sphere, torus, cylinder, cone, plane | 2 (board + showcase) |
| dashboard.tsz | 3D data dashboard | box, sphere, torus, cylinder, plane | 2 (chart + status orb) |

## Test Coverage

`test_3d_codegen.sh` — 16-point codegen validation:
- Compilation, Scene3D presence, camera/light/mesh counts
- Geometry variety, state slots, FOV values, color palette
- Dual viewports, rotations, spatial distribution
- Race-safe via flock (parallel sessions share generated_app.zig)
