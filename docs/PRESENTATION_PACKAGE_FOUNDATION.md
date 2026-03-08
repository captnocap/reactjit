# Presentation Package Foundation

This package starts from a split architecture:

- Playback can be JS-described because navigation is coarse-grained.
- Authoring must be Lua-owned because camera movement, selection, drag, resize, snapping, and text editing are hot paths.

The shared `@reactjit/presentation` foundation is responsible for:

- deck document schema
- slide/node/asset/theme types
- patch protocol between a Lua editor surface and JS persistence/UI
- pure document helpers for creation, normalization, and patch application

Initial scope in this repository:

- `packages/presentation/src/types.ts`
- `packages/presentation/src/document.ts`
- `packages/presentation/src/patches.ts`

Explicitly not in scope yet:

- a React-owned editor
- a generic transform-based camera for authoring
- storybook integration
- renderer host nodes for `PresentationEditor` / `PresentationPlayer`

The next implementation phase should add a Lua-owned editor surface that emits low-frequency document patches instead of per-frame React updates.
