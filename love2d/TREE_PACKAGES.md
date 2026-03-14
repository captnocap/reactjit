# ReactJIT — Package Source Tree

368 source files across 25 packages.

## File Counts

| Package | Files | Role |
|---------|------:|------|
| `core` | 143 | Primitives, hooks, animation, charts, effects, masks, search |
| `apis` | 31 | External APIs (Spotify, GitHub, NASA, Plex, weather, etc.) |
| `ai` | 27 | LLM agents, MCP client, chat UI, provider adapters |
| `privacy` | 22 | Tor, encryption, keyring, steganography, secure memory |
| `theme` | 16 | Theme engine, 9 presets (catppuccin, dracula, nord, etc.) |
| `storage` | 12 | SQLite, docstore, CRUD, migrations, 4 adapters |
| `controls` | 11 | Fader, knob, piano, step sequencer, XY pad, meter |
| `convert` | 11 | Units, currency, color, encoding conversion |
| `renderer` | 10 | react-reconciler host config, event dispatch, bridge |
| `math` | 10 | vec2/3/4, mat4, quat, geometry, interpolation |
| `geo` | 9 | Map, tiles, markers, GeoJSON, polyline/polygon |
| `crypto` | 9 | Hash, encrypt, sign, token, encoding |
| `physics` | 8 | PhysicsWorld, RigidBody, Collider, joints, sensors |
| `3d` | 7 | Scene, Camera, Mesh, AmbientLight, DirectionalLight |
| `router` | 6 | Navigation, history, route matching |
| `rss` | 5 | Feed parser, OPML, hooks |
| `terminal` | 5 | ClaudeCanvas, useClaude, session chrome |
| `time` | 5 | Time utilities, widgets |
| `icons` | 4 | Icon component, registry (lucide-static) |
| `layouts` | 4 | Container, nav, page presets |
| `webhooks` | 4 | Webhook handling, crypto verification |
| `audio` | 3 | Playback hooks, types |
| `media` | 3 | Video/media hooks, types |
| `server` | 3 | HTTP server hooks, types |

## Full Source Tree

```
packages/3d/src/
├── AmbientLight.tsx
├── Camera.tsx
├── DirectionalLight.tsx
├── index.ts
├── Mesh.tsx
├── Scene.tsx
└── types.ts

packages/ai/src/
├── components/
│   ├── AIChatInput.tsx
│   ├── AIConversationSidebar.tsx
│   ├── AIMessageList.tsx
│   ├── AIMessageWithActions.tsx
│   ├── AIModelSelector.tsx
│   ├── AISettingsPanel.tsx
│   └── index.ts
├── mcp/
│   ├── client.ts
│   ├── hook.ts
│   ├── index.ts
│   ├── protocol.ts
│   ├── token-estimate.ts
│   └── transport.ts
├── providers/
│   ├── anthropic.ts
│   └── openai.ts
├── templates/
│   ├── index.ts
│   ├── MinimalChat.tsx
│   ├── PowerChatUI.tsx
│   └── SimpleChatUI.tsx
├── browse.ts
├── context.tsx
├── hooks.ts
├── index.ts
├── keys.ts
├── stream.ts
├── tools.ts
└── types.ts

packages/apis/src/
├── ActivityRow.tsx
├── base.ts
├── coingecko.ts
├── CoinTickerRow.tsx
├── components.tsx
├── github.ts
├── google.ts
├── homeassistant.ts
├── HueLightBadge.tsx
├── hue.ts
├── index.ts
├── lastfm.ts
├── MediaPosterCard.tsx
├── nasa.ts
├── notion.ts
├── NowPlayingCard.tsx
├── plex.ts
├── polypizza.ts
├── rateLimit.ts
├── registry.ts
├── settings.ts
├── spotify.ts
├── StatCard.tsx
├── steam.ts
├── telegram.ts
├── tmdb.ts
├── todoist.ts
├── trakt.ts
├── useServiceKey.ts
├── weather.ts
└── ynab.ts

packages/audio/src/
├── hooks.ts
├── index.ts
└── types.ts

packages/controls/src/
├── Fader.tsx
├── index.ts
├── Knob.tsx
├── LEDIndicator.tsx
├── Meter.tsx
├── PadButton.tsx
├── PianoKeyboard.tsx
├── PitchWheel.tsx
├── StepSequencer.tsx
├── TransportBar.tsx
└── XYPad.tsx

packages/convert/src/
├── color.ts
├── convert.ts
├── currency.ts
├── encoding.ts
├── hooks.ts
├── index.ts
├── numbers.ts
├── registry.ts
├── rpc.ts
├── types.ts
└── units.ts

packages/core/src/
├── effects/
│   ├── Automata.tsx          ├── Mandala.tsx
│   ├── Combustion.tsx        ├── Mirror.tsx
│   ├── Constellation.tsx     ├── Mycelium.tsx
│   ├── Contours.tsx          ├── Orbits.tsx
│   ├── Cymatics.tsx          ├── Pipes.tsx
│   ├── EdgeGravity.tsx       ├── PixelSort.tsx
│   ├── Feedback.tsx          ├── Plotter.tsx
│   ├── FlowParticles.tsx     ├── ReactionDiffusion.tsx
│   ├── index.ts              ├── Rings.tsx
│   ├── LSystem.tsx           ├── Spirograph.tsx
│   ├── StainedGlass.tsx      ├── TextEffect.tsx
│   ├── Sunburst.tsx          ├── types.ts
│   ├── Terrain.tsx           └── Voronoi.tsx
├── masks/
│   ├── Ascii.tsx             ├── LumaMesh.tsx
│   ├── CRT.tsx               ├── OpticalFlow.tsx
│   ├── DataMosh.tsx          ├── Scanlines.tsx
│   ├── Dither.tsx            ├── SoftGlitch.tsx
│   ├── Feedback.tsx          ├── Stretch.tsx
│   ├── FishEye.tsx           ├── Tile.tsx
│   ├── HardGlitch.tsx        ├── types.ts
│   ├── index.ts              ├── VHS.tsx
│   └── Watercolor.tsx
├── search/
│   ├── AppSearch.tsx         ├── SearchCombo.tsx
│   ├── CommandPalette.tsx    ├── SearchResults.tsx
│   ├── index.ts              ├── SearchResultsSections.tsx
│   ├── SearchBar.tsx         └── SearchSchemaHint.tsx
├── ActionBar.tsx             ├── Modal.tsx
├── animation.ts              ├── Native.tsx
├── AreaChart.tsx             ├── NavPanel.tsx
├── Badge.tsx                 ├── overlay.ts
├── BarChart.tsx              ├── PieChart.tsx
├── BentoImageGallery.tsx     ├── Portal.tsx
├── Breadcrumbs.tsx           ├── preserveState.ts
├── bridge.ts                 ├── Pressable.tsx
├── CandlestickChart.tsx      ├── primitives.tsx
├── capabilities.tsx          ├── ProgressBar.tsx
├── Card.tsx                  ├── RadarChart.tsx
├── CartridgeInspector.tsx    ├── Radio.tsx
├── ChatInput.tsx             ├── ScaleContext.tsx
├── Checkbox.tsx              ├── scaleStyle.ts
├── CodeBlock.tsx             ├── ScrollView.tsx
├── colors.ts                 ├── Select.tsx
├── ContextMenu.tsx           ├── SemanticTerminal.tsx
├── context.ts                ├── Slider.tsx
├── ConversationCard.tsx      ├── Spacer.tsx
├── DebugOverlay.tsx          ├── Sparkline.tsx
├── Divider.tsx               ├── StackedBarChart.tsx
├── Emulator.tsx              ├── Switch.tsx
├── FlatList.tsx              ├── Table.tsx
├── Fleet.tsx                 ├── Tabs.tsx
├── FlexColumn.tsx            ├── Terminal.tsx
├── FlexRow.tsx               ├── TextEditor.tsx
├── hooks.ts                  ├── TextInput.tsx
├── HorizontalBarChart.tsx    ├── Toolbar.tsx
├── HoverPreviewRowsGallery.tsx ├── tw.ts
├── iconRegistry.ts           ├── types.ts
├── ImageGallery.tsx          ├── Typography.tsx
├── ImageViewerModal.tsx      ├── useAppSearch.ts
├── index.ts                  ├── useBreakpoint.ts
├── Input.tsx                 ├── useCapabilities.ts
├── LineChart.tsx             ├── useDebug.ts
├── LoadingDots.tsx           ├── useEvents.ts
├── Math.tsx                  ├── useFleet.ts
├── MessageBubble.tsx         ├── useGifRecorder.ts
├── MessageList.tsx           ├── useGPIO.tsx
├── useHotState.ts            ├── usePTY.ts
├── useIFTTT.ts               ├── useScrape.ts
├── useLocalStore.ts          ├── useSearch.ts
├── usePixelArt.tsx           ├── useSemanticTerminal.ts
├── usePorts.ts               ├── useSystemInfo.ts
├── useSystemMonitor.ts       ├── useUtils.ts
├── VideoPlayer.tsx           └── Video.tsx

packages/crypto/src/
├── encoding.ts               ├── rpc.ts
├── encrypt.ts                ├── sign.ts
├── hash.ts                   ├── token.ts
├── hooks.ts                  └── types.ts
└── index.ts

packages/geo/src/
├── GeoJSON.tsx               ├── Polyline.tsx
├── hooks.ts                  ├── TileLayer.tsx
├── index.ts                  └── types.ts
├── Map.tsx
├── Marker.tsx
└── Polygon.tsx

packages/icons/src/
├── iconNames.ts              ├── Icon.tsx
├── icons.ts                  └── index.ts

packages/layouts/src/
├── container.tsx             ├── nav.tsx
├── index.ts                  └── page.tsx

packages/math/src/
├── geometry.ts               ├── types.ts
├── hooks.ts                  ├── vec2.ts
├── index.ts                  ├── vec3.ts
├── interpolation.ts          └── vec4.ts
├── mat4.ts
└── quat.ts

packages/media/src/
├── hooks.ts
├── index.ts
└── types.ts

packages/physics/src/
├── Collider.tsx              ├── PhysicsWorld.tsx
├── hooks.ts                  ├── RigidBody.tsx
├── index.ts                  ├── Sensor.tsx
├── joints.tsx                └── types.ts

packages/privacy/src/
├── audit.ts                  ├── noise.ts
├── file-encrypt.ts           ├── policy.ts
├── gpg.ts                    ├── rpc.ts
├── hkdf.ts                   ├── safety.ts
├── hooks.ts                  ├── sanitize.ts
├── identity.ts               ├── secure-delete.ts
├── index.ts                  ├── secure-memory.ts
├── integrity.ts              ├── secure-store.ts
├── keyring.ts                ├── shamir.ts
├── metadata.ts               ├── steganography.ts
├── tor.ts                    └── types.ts

packages/renderer/src/
├── debugLog.ts               ├── Love2DApp.ts
├── errorReporter.ts          ├── measureText.ts
├── eventDispatcher.ts        ├── NativeBridge.ts
├── hostConfig.ts             ├── NativeRenderer.ts
├── index.ts                  └── WasmApp.ts

packages/router/src/
├── components.tsx             ├── matcher.ts
├── context.tsx                └── types.ts
├── history.ts
└── index.ts

packages/rss/src/
├── hooks.ts                  ├── parser.ts
├── index.ts                  └── types.ts
└── opml.ts

packages/server/src/
├── hooks.ts
├── index.ts
└── types.ts

packages/storage/src/
├── adapters/
│   ├── love2d-files.ts       ├── terminal-sqlite.ts
│   ├── memory.ts             └── web.ts
├── crud.ts                   ├── migrations.ts
├── format.ts                 ├── query.ts
├── hooks.ts                  ├── schema.ts
├── index.ts                  └── types.ts

packages/terminal/src/
├── ClaudeCanvas.tsx          ├── types.ts
├── index.ts                  ├── useClaude.ts
└── useSessionChrome.ts

packages/theme/src/
├── themes/
│   ├── catppuccin.ts         ├── one-dark.ts
│   ├── dracula.ts            ├── rose-pine.ts
│   ├── gruvbox.ts            ├── solarized.ts
│   ├── index.ts              └── tokyo-night.ts
│   └── nord.ts
├── createTheme.ts            ├── ThemeSwitcher.tsx
├── defaults.ts               ├── types.ts
├── index.ts                  └── useTheme.ts
└── ThemeProvider.tsx

packages/time/src/
├── hooks.ts                  ├── utils.ts
├── index.ts                  └── widgets.tsx
└── types.ts

packages/webhooks/src/
├── crypto.ts                 ├── index.ts
├── hooks.ts                  └── types.ts
```
