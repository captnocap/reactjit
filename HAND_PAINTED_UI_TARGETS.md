# Hand-Painted UI → .tsz Migration Targets

Seven places in the framework bypass the layout engine entirely, painting UI manually via `gpu.drawRect()` + `gpu.drawTextWrapped()`. They get no flex, no overflow clipping, no responsive sizing, no style system. Every new capability has to be reimplemented from scratch.

These are the top-priority targets for .tsz conversion, before the broader Zig → .tsz migration.

| # | File | What | Notes |
|---|------|------|-------|
| 1 | `engine.zig:2212-2228` | Debug pairing modal | Hardcoded 320x140, manual pixel positions |
| 2 | `tooltip.zig:72-106` | Tooltip overlay | Reimplements measurement, edge clamping, positioning |
| 3 | `context_menu.zig:140-198` | Context menu | Reimplements hit testing, hover, item layout, text centering |
| 4 | `qjs_runtime.zig:2142-2153` | Telemetry bar | Fixed 24px, hardcoded at win_h-24 |
| 5 | `engine.zig:1192-1235` | TextInput chrome | Focus ring, cursor, placeholder — every input reinvents cursor rendering |
| 6 | `engine_web.zig:110-161` | Web paint (full copy) | Duplicate of engine paint pipeline |
| 7 | `child_engine.zig:440-489` | Child engine paint (full copy) | Third copy of engine paint pipeline |

## Why these first

- They reinvent Box + Text from scratch
- Bug fixes don't propagate across the 3 paint copies (#5, #6, #7)
- Hit testing is hand-rolled (#3)
- No layout participation means no responsive behavior
- They're self-contained UI — easiest wins for .tsz conversion
