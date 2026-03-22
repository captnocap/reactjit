# 3D Rendering

Inline 3D elements in the 2D layout tree, rendered via wgpu to an offscreen texture with depth buffer, composited into the 2D paint pipeline.

## .tsz API

### Scene3D container with 3D.* children
```tsx
<Scene3D style={{ width: 500, height: 400 }}>
  <3D.Camera position={[0, 5, 10]} lookAt={[0, 0, 0]} fov={60} />
  <3D.Light type="ambient" intensity={0.3} />
  <3D.Light type="directional" direction={[1, -1, 1]} intensity={0.8} />
  <3D.Mesh geometry="box" size={[2, 2, 2]} color="#ff0000" position={[0, 1, 0]} rotation={[0, 45, 0]} />
  <3D.Mesh geometry="sphere" radius={1} color="#00ff00" position={[3, 1, 0]} />
  <3D.Mesh geometry="plane" size={[10, 10, 1]} color="#333333" />
</Scene3D>
```

### Elements

**Scene3D** — Container that activates the 3D render pipeline. Renders to offscreen texture at its layout dimensions.

**3D.Camera** — Camera definition.
- `position={[x, y, z]}` — camera position in world space
- `lookAt={[x, y, z]}` — point the camera aims at
- `fov={60}` — field of view in degrees

**3D.Mesh** — Renderable geometry.
- `geometry="box"|"sphere"|"plane"|"cylinder"|"cone"|"torus"` — primitive type
- `color="#rrggbb"` — diffuse color
- `position={[x, y, z]}` — world position
- `rotation={[x, y, z]}` — euler rotation in degrees
- `size={[w, h, d]}` — dimensions (box/plane)
- `radius={r}` — radius (sphere/cylinder/cone/torus)

**3D.Light** — Light source.
- `type="ambient"|"directional"|"point"` — light type
- `intensity={0.8}` — brightness multiplier
- `direction={[x, y, z]}` — direction (for directional lights)
- `position={[x, y, z]}` — position (for point lights)
- `color="#rrggbb"` — light color

**3D.Group** — Transform hierarchy (parent transform affects children). [not yet rendered]
- `position={[x, y, z]}`, `rotation={[x, y, z]}` — group transform

### Inline with 2D
3D elements live in the normal layout tree:
```tsx
<Box style={{ flexDirection: "row", gap: 16 }}>
  <Text>Stats panel</Text>
  <Scene3D style={{ width: 200, height: 200 }}>
    <3D.Mesh geometry="box" color="#ff0000" rotation={[0, 45, 0]} />
  </Scene3D>
</Box>
```

## Framework files
- `framework/gpu/scene3d.zig` — Render pipeline (vertex buffer, depth buffer, offscreen target, Blinn-Phong uniforms), procedural geometry (box; sphere/plane/cylinder/cone/torus planned), render() composites via images.queueQuad()
- `framework/gpu/shaders.zig` — `scene3d_wgsl`: WGSL vertex shader (MVP transform + normal pass-through) and fragment shader (Blinn-Phong ambient + diffuse + specular)
- `framework/math.zig` — Mat4 (m4perspective, m4lookAt, m4rotateX/Y/Z, m4multiply, m4transpose), Vec3, Quaternion
- `framework/layout.zig` — scene3d_* fields on Node (mesh/camera/light/group bools, geometry/pos/rot/scale/look/dir/size/fov/intensity/radius)
- `framework/engine.zig` — scene3d import, update(dt), render() in paintNodeVisuals

## Compiler files
- `compiler/jsx.zig` — 3D namespace lexer handling (number "3" + ident "D" + dot), parse3DVector for {[x,y,z]}, 3D prop parsing, closing tag for </3D.Mesh>
- `compiler/validate.zig` — Scene3D in primitives list

## Known limitations
- Renderer currently hardcodes a single rotating cube — does not yet read 3D.Camera/Mesh/Light props from the node tree (next step)
- Only box geometry implemented — sphere, plane, cylinder, cone, torus need procedural generators
- No orbit camera (mouse drag/scroll) — camera is fixed
- Single directional light — no point/spot lights yet
- No shadows
- No model loading (OBJ/glTF)
- No Group3D hierarchical transforms
- Scene3D required as container — 3D.Mesh cannot appear outside Scene3D yet
- wgpu Z clip range may need adjustment (OpenGL [-1,1] vs wgpu [0,1])
