.
├── 3d
│   ├── package.json
│   ├── src
│   │   ├── AmbientLight.tsx
│   │   ├── Camera.tsx
│   │   ├── DirectionalLight.tsx
│   │   ├── index.ts
│   │   ├── Mesh.tsx
│   │   ├── Scene.tsx
│   │   └── types.ts
│   └── tsconfig.json
├── ai
│   ├── package.json
│   ├── src
│   │   ├── browse.ts
│   │   ├── components
│   │   │   ├── AIChatInput.tsx
│   │   │   ├── AIConversationSidebar.tsx
│   │   │   ├── AIMessageList.tsx
│   │   │   ├── AIMessageWithActions.tsx
│   │   │   ├── AIModelSelector.tsx
│   │   │   ├── AISettingsPanel.tsx
│   │   │   └── index.ts
│   │   ├── context.tsx
│   │   ├── hooks.ts
│   │   ├── index.ts
│   │   ├── keys.ts
│   │   ├── mcp
│   │   │   ├── client.ts
│   │   │   ├── hook.ts
│   │   │   ├── index.ts
│   │   │   ├── protocol.ts
│   │   │   ├── token-estimate.ts
│   │   │   └── transport.ts
│   │   ├── providers
│   │   │   ├── anthropic.ts
│   │   │   └── openai.ts
│   │   ├── stream.ts
│   │   ├── templates
│   │   │   ├── index.ts
│   │   │   ├── MinimalChat.tsx
│   │   │   ├── PowerChatUI.tsx
│   │   │   └── SimpleChatUI.tsx
│   │   ├── tools.ts
│   │   └── types.ts
│   └── tsconfig.json
├── apis
│   ├── package.json
│   ├── src
│   │   ├── ActivityRow.tsx
│   │   ├── base.ts
│   │   ├── coingecko.ts
│   │   ├── CoinTickerRow.tsx
│   │   ├── components.tsx
│   │   ├── github.ts
│   │   ├── google.ts
│   │   ├── homeassistant.ts
│   │   ├── HueLightBadge.tsx
│   │   ├── hue.ts
│   │   ├── index.ts
│   │   ├── lastfm.ts
│   │   ├── MediaPosterCard.tsx
│   │   ├── nasa.ts
│   │   ├── notion.ts
│   │   ├── NowPlayingCard.tsx
│   │   ├── plex.ts
│   │   ├── polypizza.ts
│   │   ├── rateLimit.ts
│   │   ├── registry.ts
│   │   ├── settings.ts
│   │   ├── spotify.ts
│   │   ├── StatCard.tsx
│   │   ├── steam.ts
│   │   ├── telegram.ts
│   │   ├── tmdb.ts
│   │   ├── todoist.ts
│   │   ├── trakt.ts
│   │   ├── useServiceKey.ts
│   │   ├── weather.ts
│   │   └── ynab.ts
│   └── tsconfig.json
├── audio
│   ├── package.json
│   ├── src
│   │   ├── hooks.ts
│   │   ├── index.ts
│   │   └── types.ts
│   └── tsconfig.json
├── controls
│   ├── package.json
│   ├── src
│   │   ├── Fader.tsx
│   │   ├── index.ts
│   │   ├── Knob.tsx
│   │   ├── LEDIndicator.tsx
│   │   ├── Meter.tsx
│   │   ├── PadButton.tsx
│   │   ├── PianoKeyboard.tsx
│   │   ├── PitchWheel.tsx
│   │   ├── StepSequencer.tsx
│   │   ├── TransportBar.tsx
│   │   └── XYPad.tsx
│   └── tsconfig.json
├── core
│   ├── package.json
│   ├── src
│   │   ├── ActionBar.tsx
│   │   ├── animation.ts
│   │   ├── AreaChart.tsx
│   │   ├── Badge.tsx
│   │   ├── BarChart.tsx
│   │   ├── BentoImageGallery.tsx
│   │   ├── Breadcrumbs.tsx
│   │   ├── bridge.ts
│   │   ├── CandlestickChart.tsx
│   │   ├── capabilities.tsx
│   │   ├── Card.tsx
│   │   ├── CartridgeInspector.tsx
│   │   ├── ChartTooltip.tsx
│   │   ├── ChatInput.tsx
│   │   ├── Checkbox.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── colors.ts
│   │   ├── ContextMenu.tsx
│   │   ├── context.ts
│   │   ├── ConversationCard.tsx
│   │   ├── DebugOverlay.tsx
│   │   ├── Divider.tsx
│   │   ├── effects
│   │   │   ├── Automata.tsx
│   │   │   ├── Combustion.tsx
│   │   │   ├── Constellation.tsx
│   │   │   ├── Contours.tsx
│   │   │   ├── Cymatics.tsx
│   │   │   ├── EdgeGravity.tsx
│   │   │   ├── Feedback.tsx
│   │   │   ├── FlowParticles.tsx
│   │   │   ├── index.ts
│   │   │   ├── LSystem.tsx
│   │   │   ├── Mandala.tsx
│   │   │   ├── Mirror.tsx
│   │   │   ├── Mycelium.tsx
│   │   │   ├── Orbits.tsx
│   │   │   ├── Pipes.tsx
│   │   │   ├── PixelSort.tsx
│   │   │   ├── Plotter.tsx
│   │   │   ├── ReactionDiffusion.tsx
│   │   │   ├── Rings.tsx
│   │   │   ├── Spirograph.tsx
│   │   │   ├── StainedGlass.tsx
│   │   │   ├── Terrain.tsx
│   │   │   ├── TextEffect.tsx
│   │   │   ├── types.ts
│   │   │   └── Voronoi.tsx
│   │   ├── Emulator.tsx
│   │   ├── FlatList.tsx
│   │   ├── FlexColumn.tsx
│   │   ├── FlexRow.tsx
│   │   ├── hooks.ts
│   │   ├── HorizontalBarChart.tsx
│   │   ├── HoverPreviewRowsGallery.tsx
│   │   ├── ImageGallery.tsx
│   │   ├── ImageViewerModal.tsx
│   │   ├── index.ts
│   │   ├── LineChart.tsx
│   │   ├── LoadingDots.tsx
│   │   ├── masks
│   │   │   ├── Ascii.tsx
│   │   │   ├── CRT.tsx
│   │   │   ├── Dither.tsx
│   │   │   ├── index.ts
│   │   │   ├── Scanlines.tsx
│   │   │   ├── types.ts
│   │   │   └── VHS.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageList.tsx
│   │   ├── Modal.tsx
│   │   ├── Native.tsx
│   │   ├── NavPanel.tsx
│   │   ├── PieChart.tsx
│   │   ├── Portal.tsx
│   │   ├── Pressable.tsx
│   │   ├── primitives.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── RadarChart.tsx
│   │   ├── Radio.tsx
│   │   ├── ScaleContext.tsx
│   │   ├── scaleStyle.ts
│   │   ├── ScrollView.tsx
│   │   ├── search
│   │   │   ├── AppSearch.tsx
│   │   │   ├── CommandPalette.tsx
│   │   │   ├── index.ts
│   │   │   ├── SearchBar.tsx
│   │   │   ├── SearchCombo.tsx
│   │   │   ├── SearchResultsSections.tsx
│   │   │   ├── SearchResults.tsx
│   │   │   └── SearchSchemaHint.tsx
│   │   ├── Select.tsx
│   │   ├── Slider.tsx
│   │   ├── Spacer.tsx
│   │   ├── Sparkline.tsx
│   │   ├── StackedBarChart.tsx
│   │   ├── Switch.tsx
│   │   ├── Table.tsx
│   │   ├── Tabs.tsx
│   │   ├── Terminal.tsx
│   │   ├── TextEditor.tsx
│   │   ├── TextInput.tsx
│   │   ├── Toolbar.tsx
│   │   ├── types.ts
│   │   ├── Typography.tsx
│   │   ├── useAppSearch.ts
│   │   ├── useCapabilities.ts
│   │   ├── useDebug.ts
│   │   ├── useGPIO.tsx
│   │   ├── useLocalStore.ts
│   │   ├── usePixelArt.tsx
│   │   ├── usePorts.ts
│   │   ├── usePTY.ts
│   │   ├── useSearch.ts
│   │   ├── useSystemInfo.ts
│   │   ├── useSystemMonitor.ts
│   │   ├── VideoPlayer.tsx
│   │   └── Video.tsx
│   └── tsconfig.json
├── crypto
│   ├── package.json
│   ├── src
│   │   ├── encoding.ts
│   │   ├── encrypt.ts
│   │   ├── hash.ts
│   │   ├── hooks.ts
│   │   ├── index.ts
│   │   ├── rpc.ts
│   │   ├── sign.ts
│   │   ├── token.ts
│   │   └── types.ts
│   └── tsconfig.json
├── geo
│   ├── package.json
│   └── src
│       ├── GeoJSON.tsx
│       ├── hooks.ts
│       ├── index.ts
│       ├── Map.tsx
│       ├── Marker.tsx
│       ├── Polygon.tsx
│       ├── Polyline.tsx
│       ├── TileLayer.tsx
│       └── types.ts
├── layouts
│   ├── package.json
│   └── src
│       ├── container.tsx
│       ├── index.ts
│       ├── nav.tsx
│       └── page.tsx
├── media
│   ├── package.json
│   ├── src
│   │   ├── hooks.ts
│   │   ├── index.ts
│   │   └── types.ts
│   └── tsconfig.json
├── native
│   ├── package.json
│   ├── src
│   │   ├── debugLog.ts
│   │   ├── errorReporter.ts
│   │   ├── eventDispatcher.ts
│   │   ├── hostConfig.ts
│   │   ├── index.ts
│   │   ├── Love2DApp.ts
│   │   ├── measureText.ts
│   │   ├── NativeBridge.ts
│   │   ├── NativeRenderer.ts
│   │   └── WasmApp.ts
│   └── tsconfig.json
├── router
│   ├── package.json
│   └── src
│       ├── components.tsx
│       ├── context.tsx
│       ├── history.ts
│       ├── index.ts
│       ├── matcher.ts
│       └── types.ts
├── rss
│   ├── package.json
│   ├── src
│   │   ├── hooks.ts
│   │   ├── index.ts
│   │   ├── opml.ts
│   │   ├── parser.ts
│   │   └── types.ts
│   └── tsconfig.json
├── server
│   ├── package.json
│   ├── src
│   │   ├── hooks.ts
│   │   ├── index.ts
│   │   └── types.ts
│   └── tsconfig.json
├── storage
│   ├── package.json
│   └── src
│       ├── adapters
│       │   ├── love2d-files.ts
│       │   ├── memory.ts
│       │   ├── terminal-sqlite.ts
│       │   └── web.ts
│       ├── crud.ts
│       ├── format.ts
│       ├── hooks.ts
│       ├── index.ts
│       ├── migrations.ts
│       ├── query.ts
│       ├── schema.ts
│       └── types.ts
├── theme
│   ├── package.json
│   └── src
│       ├── createTheme.ts
│       ├── defaults.ts
│       ├── index.ts
│       ├── ThemeProvider.tsx
│       ├── themes
│       │   ├── catppuccin.ts
│       │   ├── dracula.ts
│       │   ├── gruvbox.ts
│       │   ├── index.ts
│       │   ├── nord.ts
│       │   ├── one-dark.ts
│       │   ├── rose-pine.ts
│       │   ├── solarized.ts
│       │   └── tokyo-night.ts
│       ├── ThemeSwitcher.tsx
│       ├── types.ts
│       └── useTheme.ts
├── tree.md
└── webhooks
    ├── package.json
    ├── src
    │   ├── crypto.ts
    │   ├── hooks.ts
    │   ├── index.ts
    │   └── types.ts
    └── tsconfig.json

44 directories, 306 files
