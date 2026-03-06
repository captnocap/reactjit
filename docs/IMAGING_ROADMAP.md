# Imaging Roadmap (GIMP Parity Track)

This document defines the contract surface that was added to support the next
milestones of `@reactjit/imaging`.

## 1) RPC Contract (implemented)

- `imaging:apply`
  - Input: `{ src?, operations, output?, width?, height? }`
  - Output: `{ ok, width, height, didProcess, outputPath?, error? }`
- `imaging:compose`
  - Input: `{ composition, cacheKey?, output? }`
  - Output: `{ ok, width, height, cacheHit?, dirtyRegions?, outputPath?, error? }`
- `imaging:list_ops`
- `imaging:blend_modes`
- `imaging:clear_cache`

## 2) Layer Graph Contract (implemented foundation)

Composition shape:

```ts
{
  width: number;
  height: number;
  layers: Array<{
    id: string;
    visible?: boolean;
    opacity?: number;
    blendMode?: BlendMode;
    src?: string;
    x?: number;
    y?: number;
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number; // degrees by default
    pivot?: { x: number; y: number; relative?: boolean };
    crop?: { x: number; y: number; width: number; height: number };
    operations?: ImagingOperation[];
    children?: ImagingLayer[];
  }>;
}
```

Current behavior:
- Ordered layer-stack composition.
- Per-layer blend mode + opacity.
- Nested child layers.
- Per-layer transform pass (crop + scale + rotation + pivot).
- Full-canvas dirty region reporting.
- Composition cache hook via `cacheKey`.

## 3) Non-Destructive Editing (implemented foundation)

JS history model shipped in `packages/imaging/src/history.ts`:
- Commit snapshots.
- Undo.
- Redo.
- Generic state support.

## 4) Golden Harness (implemented foundation)

`packages/imaging/src/golden.ts` includes:
- `DEFAULT_GOLDEN_FIXTURES`
- `hashRGBA(data)`
- `diffRGBA(actual, expected)`
- `runGoldenFixtures(fixtures, execute)`
- `captureGoldenHashes(fixtures, execute)`

## 5) Selection System (implemented)

In-memory mask pipeline — no filesystem round-trips.

**Lua:**
- `lua/imaging/mask_registry.lua` — in-memory mask canvas store keyed by handle ID
- `lua/imaging/ops/mask.lua` — `apply_mask` pipeline op: `mix(original, processed, mask.r)` via GLSL
- `lua/capabilities/imaging.lua`:
  - `imaging:selection_rasterize` — rasterize shape list to grayscale mask, returns maskId
  - `imaging:mask_release` — release mask from registry
  - `imaging:mask_info` — diagnostic count
  - `imaging:apply` extended with `maskId` param — composites post-pipeline result with original

**TypeScript:**
- `ImagingSelectionShape` type: rect / ellipse / polygon
- `ImagingSelectionRasterizeRequest` / `ImagingSelectionRasterizeResult`
- `ImagingApplyRequest.maskId` — optional mask handle
- `useImagingSelection` upgraded: `shapes`, `addShape`, `clearShapes`, `rasterize(w,h,shapes?)`, `activeMaskId`, `clearMask`

## 7) Draw Canvas Capability (implemented)

Interactive paint canvas owned by Lua, declared by React.

**Lua:**
- `lua/capabilities/draw_canvas.lua` — `DrawCanvas` capability (visual)
  - `canvas:paint` — draw smooth strokes along a point path
  - `canvas:erase` — erase to transparency along a path
  - `canvas:fill` — CPU flood fill via BFS on ImageData
  - `canvas:clear` — reset canvas to background
  - `canvas:get_pixel` — sample pixel (eyedropper)
  - `canvas:export` — save canvas to file
  - `DrawCanvas.getCanvas(canvasId)` — live canvas ref for layer compositing
- `lua/capabilities/imaging.lua` — layer graph extended with `drawCanvasId` source

**TypeScript:**
- `DrawCanvasProps`, `UseDrawCanvasResult` types
- `useDrawCanvas(w, h)` hook — generates stable canvasId, wraps all RPCs
- `ImagingLayer.drawCanvasId` — compose a live paint canvas as a layer

## 8) Next TODOs

- Tile-level dirty tracking in compose (replace full-canvas dirtyRegions).
- Mask clipping for canvas:paint (strokes inside selection only).
- Pressure-sensitive brush via Gaussian falloff shader stamp.
- Channel-aware blend (affect individual RGB channels with masks).

## 6) Shader Reuse in Masks + Themes (implemented)

Imaging shader patterns now power part of the mask stack via
`lua/masks/shader_grade.lua`:

- Shared GPU grade pass with hue/saturation/value, contrast, posterize,
  grain, tint, and vignette controls.
- Shader compilation + reuse via `lua/imaging/shader_cache.lua`.
- Theme-aware defaults in mask runtime (`Masks.setTheme` and `Masks.getThemeToken`)
  so masks can auto-pick palette-driven tint behavior.

Current masks using this pass:
- `CRT`
- `VHS`
- `Watercolor`
