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
│   │   ├── base.ts
│   │   ├── coingecko.ts
│   │   ├── github.ts
│   │   ├── google.ts
│   │   ├── homeassistant.ts
│   │   ├── hue.ts
│   │   ├── index.ts
│   │   ├── lastfm.ts
│   │   ├── nasa.ts
│   │   ├── notion.ts
│   │   ├── plex.ts
│   │   ├── registry.ts
│   │   ├── settings.ts
│   │   ├── spotify.ts
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
├── awesome
│   ├── package.json
│   └── src
│       ├── AwesomeServer.ts
│       └── index.ts
├── cc
│   ├── package.json
│   └── src
│       ├── CCServer.ts
│       ├── index.ts
│       └── palette.ts
├── components
│   ├── package.json
│   ├── src
│   │   ├── Badge
│   │   │   ├── Badge.story.tsx
│   │   │   └── Badge.tsx
│   │   ├── Card
│   │   │   ├── Card.story.tsx
│   │   │   └── Card.tsx
│   │   ├── Divider
│   │   │   ├── Divider.story.tsx
│   │   │   └── Divider.tsx
│   │   ├── FlexColumn
│   │   │   ├── FlexColumn.story.tsx
│   │   │   └── FlexColumn.tsx
│   │   ├── FlexRow
│   │   │   ├── FlexRow.story.tsx
│   │   │   └── FlexRow.tsx
│   │   ├── index.ts
│   │   ├── Spacer
│   │   │   ├── Spacer.story.tsx
│   │   │   └── Spacer.tsx
│   │   └── stories.ts
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
│   │   ├── StepSequencer.tsx
│   │   └── TransportBar.tsx
│   └── tsconfig.json
├── crypto
│   ├── package.json
│   ├── src
│   │   ├── encoding.ts
│   │   ├── encrypt.ts
│   │   ├── hash.ts
│   │   ├── index.ts
│   │   ├── sign.ts
│   │   ├── token.ts
│   │   └── types.ts
│   └── tsconfig.json
├── game
│   ├── package.json
│   ├── src
│   │   ├── components
│   │   │   ├── DamageNumber.tsx
│   │   │   ├── DialogueBox.tsx
│   │   │   ├── EntitySprite.tsx
│   │   │   ├── HealthBar.tsx
│   │   │   ├── InventoryGrid.tsx
│   │   │   ├── Minimap.tsx
│   │   │   ├── QuestLog.tsx
│   │   │   ├── SkillTreeView.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── TilemapView.tsx
│   │   ├── core
│   │   │   ├── useCamera.ts
│   │   │   ├── useGameLoop.ts
│   │   │   ├── useGameState.ts
│   │   │   ├── useInput.ts
│   │   │   └── useTimer.ts
│   │   ├── entity
│   │   │   ├── useEntityPool.ts
│   │   │   ├── useEntity.ts
│   │   │   ├── useSpawner.ts
│   │   │   └── useStateMachine.ts
│   │   ├── GameCanvas.tsx
│   │   ├── index.ts
│   │   ├── physics
│   │   │   ├── useCollision.ts
│   │   │   ├── usePhysics.ts
│   │   │   ├── usePlatformer.ts
│   │   │   └── useProjectile.ts
│   │   ├── systems
│   │   │   ├── useAchievements.ts
│   │   │   ├── useCombat.ts
│   │   │   ├── useCrafting.ts
│   │   │   ├── useDialogue.ts
│   │   │   ├── useEconomy.ts
│   │   │   ├── useInventory.ts
│   │   │   ├── useLoot.ts
│   │   │   ├── useProgression.ts
│   │   │   ├── useQuest.ts
│   │   │   └── useSkillTree.ts
│   │   ├── templates
│   │   │   ├── platformer.tsx
│   │   │   ├── roguelite.tsx
│   │   │   └── turnBased.tsx
│   │   ├── types.ts
│   │   └── world
│   │       ├── useFogOfWar.ts
│   │       ├── usePathfinding.ts
│   │       ├── useProcGen.ts
│   │       ├── useRoomGraph.ts
│   │       └── useTilemap.ts
│   ├── tree.md
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
├── grid
│   ├── package.json
│   └── src
│       ├── flatten.ts
│       ├── index.ts
│       ├── layout.ts
│       ├── RenderServer.ts
│       └── transports
│           ├── stdio.ts
│           ├── types.ts
│           └── websocket.ts
├── hs
│   ├── package.json
│   └── src
│       ├── HammerspoonServer.ts
│       └── index.ts
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
│   │   └── NativeRenderer.ts
│   └── tsconfig.json
├── nvim
│   ├── package.json
│   └── src
│       ├── index.ts
│       └── NvimServer.ts
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
├── shared
│   ├── package.json
│   ├── src
│   │   ├── ActionBar.tsx
│   │   ├── animation.ts
│   │   ├── AreaChart.tsx
│   │   ├── Badge.tsx
│   │   ├── BarChart.tsx
│   │   ├── Breadcrumbs.tsx
│   │   ├── bridge.ts
│   │   ├── capabilities.tsx
│   │   ├── Card.tsx
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
│   │   ├── FlatList.tsx
│   │   ├── FlexColumn.tsx
│   │   ├── FlexRow.tsx
│   │   ├── hooks.ts
│   │   ├── HorizontalBarChart.tsx
│   │   ├── ImageGallery.tsx
│   │   ├── ImageViewerModal.tsx
│   │   ├── index.ts
│   │   ├── LineChart.tsx
│   │   ├── LoadingDots.tsx
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
│   │   ├── Select.tsx
│   │   ├── Slider.tsx
│   │   ├── Spacer.tsx
│   │   ├── Sparkline.tsx
│   │   ├── StackedBarChart.tsx
│   │   ├── Switch.tsx
│   │   ├── Table.tsx
│   │   ├── Tabs.tsx
│   │   ├── TextEditor.tsx
│   │   ├── TextInput.tsx
│   │   ├── Toolbar.tsx
│   │   ├── types.ts
│   │   ├── useCapabilities.ts
│   │   ├── useDebug.ts
│   │   ├── usePixelArt.tsx
│   │   ├── usePorts.ts
│   │   ├── useSystemInfo.ts
│   │   ├── useSystemMonitor.ts
│   │   ├── VideoPlayer.tsx
│   │   └── Video.tsx
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
├── terminal
│   ├── package.json
│   └── src
│       ├── ansi.ts
│       ├── index.ts
│       ├── input.ts
│       └── TerminalApp.ts
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
├── web
│   ├── package.json
│   ├── src
│   │   ├── CanvasBridge.ts
│   │   ├── index.ts
│   │   ├── LoveInstance.tsx
│   │   └── WebBridge.ts
│   └── tsconfig.json
└── webhooks
    ├── package.json
    ├── src
    │   ├── crypto.ts
    │   ├── hooks.ts
    │   ├── index.ts
    │   └── types.ts
    └── tsconfig.json

71 directories, 329 files
