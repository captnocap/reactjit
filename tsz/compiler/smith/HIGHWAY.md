# The I-5 Highway

The compiler is a highway, not a funnel. Lanes exit and re-enter the shared road multiple times during compilation.

## The Shape

One straight line. Parabolas that leave and come back. That's it.

```
          ╭─ soup ─╮              ╭─ soup ─╮
         ╱          ╲            ╱          ╲
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
.tsz in   lex    detect   shared parse    shared collect     emit      .zig out
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         ╲          ╱            ╲          ╱
          ╰ mixed ─╯              ╰ mixed ─╯
         ╲          ╱            ╲          ╱
          ╰─ chad ─╯              ╰─ chad ─╯
                                 ╲    ╱╲    ╱
                                  ╰──╯  ╰──╯
                                  widget app
                                   lib  mod
```

The baseline is the compile path. It's always straight. The parabolas are lane-specific work — they leave the baseline, do their thing, and come back. Some lanes (chad) have parabolas within parabolas (widget/app/lib/module). But the baseline never bends.

```mermaid
graph LR
    subgraph PORTLAND["🏁 PORTLAND — Source In"]
        SRC[".tsz source"]
    end

    subgraph I5_ENTRY["I-5 — Shared Entry"]
        LEX["core.js<br/>lex + detect tier"]
    end

    subgraph EXITS_1["Exit 1 — Lane Detection"]
        SOUP_GATE["soup.js<br/>gate"]
        MIXED_GATE["mixed.js<br/>gate"]
        CHAD_GATE["chad.js<br/>gate"]
    end

    subgraph SOUP_TOURISM["Soup Sightseeing"]
        SOUP_HTML["html_mapping.js<br/>div→Box, button→Pressable"]
        SOUP_CSS["style_normalize.js<br/>CSS→inline styles"]
        SOUP_REACT["react_compat.js<br/>useState, imports"]
    end

    subgraph MIXED_TOURISM["Mixed Sightseeing"]
        MIX_APP["app.js<br/>app entry"]
        MIX_PAGE["page.js<br/>page handling"]
        MIX_MOD["module.js<br/>module handling"]
        MIX_SCRIPT["script_bridge.js<br/>script/lscript/zscript"]
    end

    subgraph CHAD_TOURISM["Chad Sightseeing"]
        CHAD_WIDGET["widget.js<br/>monolith"]
        CHAD_APP["app.js<br/>pages + components"]
        CHAD_LIB["lib.js<br/>owns modules"]
        CHAD_MOD["module.js<br/>standalone or child"]
        CHAD_BLOCKS["blocks.js<br/>var/state/types/functions"]
        CHAD_FLOW["control_flow.js<br/>if/for/during/switch"]
    end

    subgraph I5_MIDDLE["I-5 — Shared Infrastructure (lanes cross back here)"]
        PARSE["parse/<br/>build_node, children, brace"]
        COLLECT["collect/<br/>preflight passes"]
        PREFLIGHT["preflight/<br/>tier validation"]
    end

    subgraph I5_EXIT["I-5 — Shared Exit"]
        EMIT["emit/<br/>node.js, handler.js,<br/>map_pools.js, state.js"]
    end

    subgraph SEATTLE["🏁 SEATTLE — Zig Out"]
        ZIG[".zig generated output<br/>(identical regardless of lane)"]
    end

    SRC --> LEX
    LEX --> SOUP_GATE
    LEX --> MIXED_GATE
    LEX --> CHAD_GATE

    SOUP_GATE --> SOUP_HTML --> SOUP_CSS --> SOUP_REACT
    MIXED_GATE --> MIX_APP & MIX_PAGE & MIX_MOD
    MIX_APP --> MIX_SCRIPT
    CHAD_GATE --> CHAD_WIDGET & CHAD_APP & CHAD_LIB & CHAD_MOD
    CHAD_APP --> CHAD_BLOCKS --> CHAD_FLOW
    CHAD_LIB --> CHAD_BLOCKS
    CHAD_MOD --> CHAD_BLOCKS

    %% Re-entry to I-5 for shared parse
    SOUP_REACT --> PARSE
    MIX_SCRIPT --> PARSE
    CHAD_FLOW --> PARSE

    PARSE --> COLLECT --> PREFLIGHT

    %% Lanes may exit again after shared parse for more lane-specific work
    PREFLIGHT --> EMIT

    EMIT --> ZIG
```

## The Key Insight

**Lanes cross back onto I-5 mid-journey.** This is not fork → do work → merge. It's:

1. **I-5 entry** — `core.js` lexes, detects tier
2. **Exit** — lane gate dispatches to lane-specific logic
3. **Lane-specific** — soup maps HTML, mixed handles JSX, chad parses blocks
4. **Re-enter I-5** — shared `parse/` infrastructure (all lanes use the same parser)
5. **Exit again** — lane-specific post-parse transforms (if needed)
6. **Re-enter I-5** — shared `collect/` and `preflight/` passes
7. **I-5 to Seattle** — shared `emit/` generates Zig

The shared infrastructure (parse, collect, preflight, emit) is the highway. The lane-specific logic is the scenic route. You can't get to Seattle without getting back on I-5.

## Why This Matters

- **Adding a new lane** (e.g. a visual builder that emits .tsz) = adding a new exit ramp. parse/ and emit/ don't change.
- **Fixing a parse bug** = fixing it on I-5. All lanes benefit.
- **Fixing a lane bug** = fixing it on the scenic route. Other lanes unaffected.
- **Parity tests** prove all scenic routes lead to the same Seattle. If one route arrives with different cargo, that route has a bug.

## The Chad Fractal

Chad is the most complex scenic route because it has sub-exits:

```
chad.js gate
  │
  ├── widget.js ──→ I-5 (parse) ──→ I-5 (emit)
  │
  ├── app.js ──→ chad/blocks.js ──→ I-5 (parse) ──→ I-5 (emit)
  │   └── (pages and components are ambient — resolved here)
  │
  ├── lib.js ──→ chad/blocks.js ──→ I-5 (parse) ──→ I-5 (emit)  
  │   └── (modules are ambient — resolved here)
  │
  └── module.js ──→ chad/blocks.js ──→ I-5 (parse) ──→ I-5 (emit)
      └── (standalone .mod.tsz OR child of lib — same parse, same emit)
```

Widget takes the express lane (minimal scenic route).
App and lib take the longest routes (ambient resolution, sub-lane detection).
Module is the hybrid — can ride with lib or drive alone.

All arrive at the same Seattle.
