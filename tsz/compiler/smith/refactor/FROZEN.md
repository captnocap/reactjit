# Frozen Reference Tree

`refactor/` is no longer the active Smith implementation.

The live compiler now loads from the promoted top-level layout:

- `compiler/smith/core.js`
- `compiler/smith/collect/*`
- `compiler/smith/lanes/*`
- `compiler/smith/parse/*`
- `compiler/smith/preflight/*`
- `compiler/smith/emit/*`
- `compiler/smith/LOAD_ORDER.txt`

This directory is kept only as a historical snapshot. It is not part of the active bundle manifest, and `zig build smith-sync` reports if the manifest still points here.

Do not add new work in this tree. If Smith behavior changes, edit the promoted paths instead.
