# FROZEN REFERENCE COMPILER — DO NOT EDIT

These files are the OLD monolithic Zig compiler (25,000+ lines).
They have been replaced by Forge+Smith (compiler/forge.zig + compiler/smith/*.js).

## Why they exist

Smith's output must be byte-identical to what this code produces.
These files are the reference implementation we verify against.
The compiled binary of this code lives at `bin/tsz` (binary hash: fa6a74bc...).

## DO NOT

- Edit any file in this directory
- Move files out of this directory
- Delete any file
- Import from these files in new code

## The active compiler files are

- `compiler/forge.zig` — Forge entry point (Zig kernel)
- `compiler/smith_bridge.zig` — QuickJS bridge
- `compiler/lexer.zig` — tokenizer (shared between old and new)
- `compiler/cli.zig` — CLI (still used by bin/tsz, will be replaced by forge CLI)
- `compiler/smith/*.js` — Smith (the JS compiler brain)
