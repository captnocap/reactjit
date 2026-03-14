# Storybook Audit Trail

This file tracks whether a storybook demo is showing a real system path or only a visual/storytelling layer.

Scope of this pass:
- Static source audit only.
- No build, no runtime confirmation, no network verification.
- A story can still render through the real ReactJIT renderer while the feature it presents is fake or only partially wired.

## Rubric

`real path`
- The story calls the real package/component/hook surface and that surface reaches bridge/RPC/native code or a real OS/runtime event path.

`mixed`
- Some part of the story is real, but the displayed scenario also depends on seeded data, documentation-only panels, environment-dependent hardware/files, or nearby mock UI.

`mock/problem`
- The story is explicitly placeholder, visual-only, or otherwise not proving the system it claims to show.

## Global Baseline

- The storybook shell itself mounts through the real native renderer: [storybook/src/main.tsx](/home/siah/creative/reactjit/storybook/src/main.tsx)
  - Uses `NativeBridge` and `createRoot` from renderer packages.
- A no-op bridge also exists for stories that only need context and local state: [storybook/src/StoryBridge.ts](/home/siah/creative/reactjit/storybook/src/StoryBridge.ts)
  - This is a warning sign for stories that may look interactive without touching any backend.

## Findings

| Story | Status | Why |
|---|---|---|
| `Crypto` | `real path` | The story calls `useCrypto()` in live demos, and the package surface is bridge/RPC-backed. See [storybook/src/stories/CryptoStory.tsx](/home/siah/creative/reactjit/storybook/src/stories/CryptoStory.tsx) and [packages/crypto/src/index.ts](/home/siah/creative/reactjit/packages/crypto/src/index.ts). |
| `Storage` | `mixed` | `useLocalStore()` is real and persists through `localstore:get/set` RPC into SQLite-backed storage, but some search examples are pure in-memory TS demos. See [storybook/src/stories/StorageStory.tsx](/home/siah/creative/reactjit/storybook/src/stories/StorageStory.tsx) and [packages/core/src/useLocalStore.ts](/home/siah/creative/reactjit/packages/core/src/useLocalStore.ts). |
| `Capabilities` | `mixed` | `useCapabilities()` is real RPC discovery and `Timer` is a real capability path, but event-bus examples are also local in-process behavior. See [storybook/src/stories/CapabilitiesStory.tsx](/home/siah/creative/reactjit/storybook/src/stories/CapabilitiesStory.tsx) and [packages/core/src/useCapabilities.ts](/home/siah/creative/reactjit/packages/core/src/useCapabilities.ts). |
| `Files` | `mixed` | File-drop handling is a real OS event path (`onFileDrop`, drag enter/leave), but parts of the page are explanatory and classification helpers are pure TS. See [storybook/src/stories/FilesStory.tsx](/home/siah/creative/reactjit/storybook/src/stories/FilesStory.tsx). |
| `Overlay` | `mixed` | `useOverlay()` polls real overlay RPC state and exposes control methods, but much of the story is diagrams/documentation and some preview sections are mockups. See [storybook/src/stories/OverlayStory.tsx](/home/siah/creative/reactjit/storybook/src/stories/OverlayStory.tsx) and [packages/core/src/overlay.ts](/home/siah/creative/reactjit/packages/core/src/overlay.ts). |
| `Render` | `mixed` | The story mounts real `<Render>` and `<Libretro>` components for capture/VM/emulation flows, but those demos depend on external hardware, files, and host setup. They are real paths, but not self-proving in static audit. See [storybook/src/stories/RenderStory.tsx](/home/siah/creative/reactjit/storybook/src/stories/RenderStory.tsx). |
| `NES Emulator` | `real path` | The story mounts the real `<Emulator>` component and waits for a dropped ROM. See [storybook/src/stories/EmulatorStory.tsx](/home/siah/creative/reactjit/storybook/src/stories/EmulatorStory.tsx). |
| `Networking` | `mixed` | The story contains one actual `useScrape()` demo, but most of the page is API showcase/documentation strings rather than live integrations. See [storybook/src/stories/NetworkingStory.tsx](/home/siah/creative/reactjit/storybook/src/stories/NetworkingStory.tsx) and [packages/core/src/useScrape.ts](/home/siah/creative/reactjit/packages/core/src/useScrape.ts). |
| `Finance` | `mixed` | Indicator computation goes through real finance hooks/RPC, but displayed market activity is intentionally synthetic/seeded (`useSyntheticCandles`, generated book/ticker data). See [storybook/src/stories/FinanceStory.tsx](/home/siah/creative/reactjit/storybook/src/stories/FinanceStory.tsx) and [packages/finance/src/hooks.ts](/home/siah/creative/reactjit/packages/finance/src/hooks.ts). |
| `Chemistry` | `mixed` | The story uses real chemistry hooks/components, including RPC-backed reactions and imperative PubChem fetch, but this pass did not runtime-verify external lookup or all capability renderers. See [storybook/src/stories/ChemistryStory.tsx](/home/siah/creative/reactjit/storybook/src/stories/ChemistryStory.tsx) and [packages/chemistry/src/index.ts](/home/siah/creative/reactjit/packages/chemistry/src/index.ts). |
| `Windows` | `mixed` | The window/notification parts appear to spawn real child OS windows, but the crash-screen section includes an explicit BSOD mock preview. See [storybook/src/stories/WindowsStory.tsx](/home/siah/creative/reactjit/storybook/src/stories/WindowsStory.tsx). |
| `Privacy` | `mock/problem` | The file presents itself as “visual demos” and does not import or call `usePrivacy()` in the live demo sections. It does not currently prove the privacy runtime behind the API. See [storybook/src/stories/PrivacyStory.tsx](/home/siah/creative/reactjit/storybook/src/stories/PrivacyStory.tsx). |
| `AI` | `mixed` | The story is now explicitly labeled as externally gated. It remains a documentation/demo shell unless a user supplies provider credentials or a compatible local endpoint, so it should not be treated as live proof by default. See [storybook/src/stories/AIStory.tsx](/home/siah/creative/reactjit/storybook/src/stories/AIStory.tsx). |
| `CreativeConcepts` | `mock/problem` | The file contains explicit `TODO` markers and comments calling out placeholder content and mocks. It should not be trusted as evidence of a real subsystem. See [storybook/src/stories/CreativeConceptsStory.tsx](/home/siah/creative/reactjit/storybook/src/stories/CreativeConceptsStory.tsx). |

## Immediate Risk Calls

- `Privacy` and `CreativeConcepts` are the clearest audit failures in this pass.
- `AI` is externally gated rather than inherently fake; it still needs clear labeling because the story is not self-proving without a user-supplied connector.
- `Finance` should not be interpreted as live market integration; it is mostly proving compute/rendering over synthetic inputs.
- `Render`, `Overlay`, `Windows`, and `Networking` expose real paths, but the story pages mix verification with explanation and environment-dependent affordances.

## Next Audit Steps

1. Add an `auditStatus` field to story registration so suspect stories are visible inside the storybook UI.
2. For each `mixed` story, split “real demo” bands from “concept/mock” bands and label them directly in the UI.
3. Replace `Privacy` and `AI` with minimal live demos that actually call their package surfaces and display success/error from the real runtime.
4. Remove or quarantine `CreativeConcepts` until the TODO placeholders are replaced with actual components.
