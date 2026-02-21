# TODO: Cartridge Inspector

Goal: Drop a `.cart` file into the inspector. Get a full nutrition label — what it claims,
what it contains, whether the build is legit. Built as a cartridge itself, with zero
network and zero filesystem access beyond reading the dropped file. Fully self-auditing.

---

## Core Concept

The inspector is the trust layer for the platform. No gatekeeper decides what ships.
Users have the tool to verify themselves. Not "trust us, we reviewed it" — "here are the
tools, verify it yourself."

Three layers:
1. **Declare** — manifest says what the cart needs
2. **Enforce** — runtime enforces what the manifest declared (see TODO-CAPABILITY-RUNTIME.md)
3. **Audit** — inspector shows what the cart claimed and whether the binary matches

---

## Manifest Format

Every cart embeds a manifest at build time. Format TBD (ELF section or appended block).
Contents:

```json
{
  "name": "monero-wallet",
  "version": "0.1.0",
  "capabilities": {
    "network": ["18081", "9050"],
    "filesystem": ["./wallet/"],
    "clipboard": false,
    "ipc": false,
    "gpu": true
  },
  "sources": [
    { "file": "src/wallet/wallet2.cpp", "hash": "sha256:..." },
    ...
  ],
  "build": {
    "commit": "abc123",
    "toolchain": "zig 0.14.0",
    "reproducible": true
  },
  "signature": "..."
}
```

- [ ] Define manifest format (schema, embedded location in binary)
- [ ] CLI command: `reactjit manifest <project>` — generates manifest from build
- [ ] CLI command: `reactjit sign <cart>` — signs manifest with developer key
- [ ] `reactjit build dist:*` embeds manifest automatically

---

## Inspector UI

Built as a React cartridge. Drag a `.cart` onto the window — it fans out into panels.

**Layout concept:**
```
┌─────────────────────────────────────────────────────────┐
│  drop a cartridge to inspect it                         │
├──────────────────┬──────────────────┬───────────────────┤
│  CAPABILITIES    │  DEPENDENCY TREE │  AUDIT RESULTS    │
│                  │                  │                    │
│  ✓ network       │  wallet2.cpp     │  ✓ no mining      │
│    └ :18081      │  └ crypto/...    │  ✓ no clipboard   │
│    └ tor:9050    │  openssl         │  ✓ no daemon      │
│  ✓ filesystem    │  └ libssl        │  ✓ sig verified   │
│    └ ./wallet/   │                  │                    │
│  ✗ clipboard     │                  │  ⚠ 3 undeclared   │
│  ✗ ipc           │                  │    attempts logged │
└──────────────────┴──────────────────┴───────────────────┘
```

- [ ] Drag-and-drop `.cart` file onto window (uses SDL2 drag-drop, already in `dragdrop.lua`)
- [ ] Parse manifest from binary (ELF section reader or appended block parser in Lua/FFI)
- [ ] Capability panel — declared capabilities with visual indicators
- [ ] Dependency panel — source file tree from manifest, expandable
- [ ] Audit panel — symbol scan results (mining check, clipboard check, etc.)
- [ ] Signature panel — verified/unverified against known developer keys
- [ ] "Anomaly detection" — cart requests MORE permissions than typical cart of its type
- [ ] Expand any panel for details

**Red flags surfaced automatically:**
- Capability declared but not in any known good manifest for this cart type
- Binary contains symbols that aren't covered by declared capabilities
- Signature missing or invalid
- Undeclared capability attempts logged during a sandbox run

---

## Sandbox Mode

For deeper inspection: run the cart in a zero-capability sandbox, log every capability
attempt, show what it tried to do vs. what it declared.

- [ ] Sandbox runner: launch cart with capabilities = {} (nothing)
- [ ] Intercept all capability requests via runtime hooks
- [ ] Log: `[timestamp] attempted network call to 8.8.8.8:443 — NOT DECLARED`
- [ ] Surface log in inspector UI after sandbox run
- [ ] User sees: "during execution, this cart attempted 12 undeclared operations"

This turns the inspector from static analysis into behavioral analysis.

---

## The Self-Audit Property

The inspector cartridge's own manifest:
```json
{
  "capabilities": {
    "network": false,
    "filesystem": ["./drop-target (read-only)"],
    "clipboard": false,
    "ipc": false
  }
}
```

Zero network. Read-only filesystem access for the dropped file only. This is auditable by
running the inspector through itself. A fully self-referential trust chain.

---

## Phases

**Phase 1 — Static inspector**
- [ ] Manifest format defined
- [ ] Inspector reads manifest from dropped cart
- [ ] Shows capabilities, sources, signature status
- [ ] Symbol audit (mining check, Monero-specific rules)
- [ ] Basic UI: three panels, green/red indicators

**Phase 2 — Sandbox runner**
- [ ] Zero-capability sandbox launch
- [ ] Capability attempt interception and logging
- [ ] UI shows behavioral audit log

**Phase 3 — Community trust anchors**
- [ ] Known-good manifest registry (offline, shipped with inspector)
- [ ] "This cart matches community-verified build from commit abc123"
- [ ] Reproducible build verification: user can rebuild and compare hash
