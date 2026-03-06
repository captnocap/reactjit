# Data Spreadsheet Case

This is the case for `@reactjit/data` as an Excel replacement inside ReactJIT apps:

1. Runtime-native spreadsheet engine:
   Cell references (`A1`), ranges (`A1:B10`), dependency evaluation, and cycle/error handling run in-process.
2. Built-in conversion formulas:
   `CONVERT(value, from, to)` is wired directly to `@reactjit/convert`.
3. Built-in math formulas:
   `CLAMP`, `LERP`, `REMAP`, `SMOOTHSTEP`, `DIST2D`, `NORM2D` are wired to `@reactjit/math`.
4. Local-first operation:
   No SaaS sheet dependency; deterministic formulas work offline.
5. UI component parity:
   `Spreadsheet` ships as a reusable component with row/column headers, selection, formula bar, and editable cell map.

Example formulas:

```text
=SUM(B2:B5)
=AVG(E2:E5)
=CONVERT(A2, "mi", "km")
=REMAP(B2, 0, 100, 0, 10)
=CLAMP(E2, 0, 100)
=IF(E2 >= 90, "A", "B")
```
