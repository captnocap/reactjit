# ReactJIT — Framework Tree

The rendering framework, annotated. 17 node dependencies total.

```
reactjit/
├── cli/                              # CLI tool (`rjit`)
│   ├── bin/
│   │   └── reactjit.mjs             # Entry point
│   ├── commands/                     # 21 commands
│   │   ├── build.mjs                # Dev/prod builds (Love2D, Linux, macOS, Windows)
│   │   ├── dev.mjs                  # Watch + HMR
│   │   ├── init.mjs                 # Scaffold new project
│   │   ├── update.mjs               # Sync runtime into project
│   │   ├── lint.mjs                 # Static layout linter
│   │   ├── test.mjs                 # Test runner
│   │   ├── screenshot.mjs           # Headless capture
│   │   ├── convert.mjs              # Format conversion
│   │   ├── diagnose.mjs             # Project diagnostics
│   │   ├── fonts.mjs                # Font management
│   │   ├── manifest.mjs             # App manifest
│   │   ├── overlay.mjs              # Dev overlay
│   │   ├── search-index.mjs         # Docs search index
│   │   ├── storybook.mjs            # Storybook commands
│   │   ├── tsl.mjs                  # TSL transpiler
│   │   └── migrate-*.mjs            # Migration tools (tkinter, pyqt6, swiftui, blessed, flutter)
│   ├── lib/                          # Shared CLI internals
│   │   ├── aliases.mjs              # Path resolution
│   │   ├── log.mjs                  # Logging
│   │   ├── migration-core.mjs       # Migration engine
│   │   ├── test-shim.js             # Test globals injected into QuickJS
│   │   └── tsl.mjs                  # TSL compiler lib
│   ├── runtime/                      # Distributed runtime (copied into projects)
│   │   ├── bin/                     # Platform binaries (launcher, tor)
│   │   ├── data/                    # dictionary.db
│   │   ├── fonts/                   # Font bundles
│   │   ├── lib/                     # Native libs (.so)
│   │   │   ├── libquickjs.so        # QuickJS FFI bridge
│   │   │   ├── libsqlite3.so.0      # SQLite
│   │   │   ├── libmpv.so.2          # Video playback
│   │   │   ├── libcrypto.so         # Crypto
│   │   │   ├── libsodium.so         # NaCl crypto
│   │   │   ├── libblake3.so         # Blake3 hashing
│   │   │   ├── libarchive.so.13     # Archive extraction
│   │   │   └── liboverlay_hook.so   # Overlay injection
│   │   ├── lua/                     # Lua runtime (synced from lua/)
│   │   └── reactjit/               # TS packages (synced from packages/)
│   ├── template/                     # `rjit init` scaffold
│   │   ├── src/
│   │   ├── conf.lua
│   │   ├── main.lua
│   │   └── tsconfig.json
│   ├── test/                         # CLI + TSL tests
│   ├── targets.mjs                   # Build target definitions (single source of truth)
│   └── package.json
│
├── lua/                              # Lua runtime (SOURCE OF TRUTH)
│   ├── init.lua                     # Entry point / run loop
│   ├── layout.lua                   # Flex layout engine
│   ├── painter.lua                  # Love2D render pipeline (OpenGL 2.1)
│   ├── tree.lua                     # Instance tree
│   ├── events.lua                   # Event dispatch
│   ├── measure.lua                  # Text measurement
│   ├── bridge_quickjs.lua           # QuickJS FFI bridge
│   ├── target_love2d.lua            # Renderer target interface
│   ├── window_manager.lua           # Multi-window (subprocess IPC)
│   ├── animate.lua                  # Animation system
│   ├── capabilities.lua             # Capability registry
│   ├── capabilities/                # 19 registered capabilities
│   │   ├── audio.lua               ├── physics.lua
│   │   ├── scene3d.lua             ├── terminal.lua
│   │   ├── llm_agent.lua           ├── notification.lua
│   │   ├── boids.lua               ├── timer.lua
│   │   ├── window.lua              ├── render.lua
│   │   ├── step_sequencer.lua      ├── image_select.lua
│   │   ├── image_process.lua       ├── semantic_terminal.lua
│   │   ├── devtools_embed.lua      └── gpio_*.lua (4)
│   ├── audio/                       # Modular audio engine
│   │   ├── engine.lua              ├── graph.lua
│   │   ├── midi.lua                ├── module.lua
│   │   └── modules/                 # 11 DSP modules (osc, filter, delay, env, etc.)
│   ├── effects/                     # 24 visual effects (automata, voronoi, pipes, etc.)
│   ├── masks/                       # 15 post-process masks (CRT, glitch, dither, etc.)
│   ├── themes/                      # 10 color themes (catppuccin, dracula, nord, etc.)
│   ├── g3d/                         # 3D engine (camera, model, matrices, collisions)
│   ├── devtools/                    # F12 devtools (wireframe, perf, network, logs)
│   ├── classifiers/                 # Terminal content classifiers
│   ├── gpio/                        # Hardware GPIO (gpiod, i2c, serial, spi)
│   ├── child_window/                # Multi-window subprocess
│   ├── emulator/                    # NES emulator (agnes.c)
│   ├── tsl/                         # TSL runtime
│   └── ...                          # 90+ modules: chart, codeblock, texteditor, vterm,
│                                    #   pty, sqlite, http, websocket, geo, map, latex,
│                                    #   crypto, tor, dragdrop, spellcheck, etc.
│
├── packages/                         # TypeScript packages (SOURCE OF TRUTH)
│   ├── core/         @reactjit/core       # Primitives, hooks, animation, types
│   ├── renderer/     @reactjit/renderer   # react-reconciler host config, event dispatch
│   ├── 3d/           @reactjit/3d         # Scene3D, lights, camera, mesh
│   ├── ai/           @reactjit/ai         # LLM agent integration
│   ├── apis/         @reactjit/apis       # External API wrappers
│   ├── audio/        @reactjit/audio      # Audio playback, synth
│   ├── controls/     @reactjit/controls   # Higher-level UI controls
│   ├── convert/      @reactjit/convert    # Format conversion
│   ├── crypto/       @reactjit/crypto     # Cryptographic utilities
│   ├── geo/          @reactjit/geo        # Geolocation, maps
│   ├── icons/        @reactjit/icons      # Icon components
│   ├── layouts/      @reactjit/layouts    # Layout presets
│   ├── math/         @reactjit/math       # Math utilities
│   ├── media/        @reactjit/media      # Video, media playback
│   ├── physics/      @reactjit/physics    # Physics simulation
│   ├── privacy/      @reactjit/privacy    # Privacy tools (Tor, etc.)
│   ├── router/       @reactjit/router     # Navigation / routing
│   ├── rss/          @reactjit/rss        # RSS feed parsing
│   ├── server/       @reactjit/server     # HTTP server
│   ├── storage/      @reactjit/storage    # SQLite, docstore
│   ├── terminal/     @reactjit/terminal   # Terminal integration
│   ├── theme/        @reactjit/theme      # Theming system
│   ├── time/         @reactjit/time       # Time utilities
│   └── webhooks/     @reactjit/webhooks   # Webhook handling
│
├── storybook/                        # THE framework reference app
│   ├── lua -> ../lua                 # SYMLINK to source of truth
│   ├── love/
│   │   ├── lua -> ../../lua          # SYMLINK to source of truth
│   │   ├── main.lua                 # Love2D entry
│   │   ├── conf.lua                 # Love2D config
│   │   └── bundle.js               # Built JS bundle
│   ├── src/
│   │   ├── stories/                 # 60+ stories (every feature demonstrated)
│   │   │   └── _shared/             # StoryScaffold, shared components
│   │   ├── docs/                    # Documentation viewer
│   │   ├── playground/              # Live code playground
│   │   ├── tsl/                     # TSL examples
│   │   ├── main.tsx                 # Love2D entry
│   │   └── main-wasm.tsx            # WASM entry
│   ├── lib/                         # Native libs (.so)
│   ├── fonts/                       # 16 font families (multilingual)
│   ├── dist/                        # Built outputs
│   └── data/                        # Recordings, dictionaries
│
├── node_modules/                     # 17 dependencies (THAT'S IT)
│   ├── react                        # React 18.3
│   ├── react-reconciler             # Custom reconciler
│   ├── scheduler                    # React scheduler
│   ├── esbuild                      # Bundler
│   │   └── @esbuild/linux-x64      # Platform binary
│   ├── typescript                   # Type checking
│   ├── @types/react                 # React types
│   ├── @types/prop-types            # PropTypes types
│   ├── @noble/ciphers              # Crypto primitives
│   ├── @noble/curves               # Elliptic curves
│   ├── @noble/hashes               # Hash functions
│   ├── @scure/base                  # Encoding utilities
│   ├── lucide-static                # Icons (SVG data)
│   ├── js-tokens                    # JS tokenizer
│   ├── loose-envify                 # Env substitution
│   ├── csstype                      # CSS type definitions
│   └── @reactjit/*                  # Workspace symlinks -> packages/*
```
