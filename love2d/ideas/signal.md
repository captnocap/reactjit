# SIGNAL

A multiplayer spy game where you run an underground radio station in a procedurally generated city, and every mechanic maps to a real framework feature.

## Premise

You're an operator in a decentralized resistance network. Your job is to broadcast coded messages, recruit agents, trade resources, and avoid detection. Every player runs their own node. There is no central server. The game IS the network.

**Tagline: "The game is the network. The network is real."**

## The Core Insight

The game is indistinguishable from the real tools. Your radio station is a real streaming server. Your dead-drop is a real file server. Your encrypted messages use real cryptography. Your Tor addresses are real hidden services. A player who masters SIGNAL has actually learned to run encrypted communications infrastructure.

The game teaches operational security by making it the gameplay. The tutorial isn't "press X to encrypt." It's "write a cipher that the other player can't break, or you lose your territory."

## Framework Feature Map

Every single system in the framework is load-bearing in the gameplay loop. Nothing simulated, nothing forced.

### Audio Engine + MIDI — The Broadcast Equipment

The synth rack IS your station. Composing and performing music is the core gameplay. Each module (oscillator, filter, delay) is gear you find, trade, or build. Your rack configuration IS your progression system. Plug in a MIDI controller and you're performing live — that's how you build an audience.

You encode secret messages into audio using steganography. The pedalboard UI is how you modulate your signal — apply distortion to hide data, use delay to encode timing-based messages. Other players use their own DSP chain to decode what you sent.

### Tor + WebSocket + P2P — The Actual Network

Your in-game radio station is an actual `.onion` hidden service. Other players connect to your station by entering your .onion address. The game's network IS the real network. Getting "discovered" by the enemy means your node actually goes offline.

There's no matchmaking server. You find other stations by tuning frequencies — literally connecting to onion addresses. Forming a mesh network IS the multiplayer.

### AI + Chat + Tools — NPCs and Your Producer

The NPCs are AI. `useChat` powers interrogation scenes — you question a captured enemy agent through actual conversation. The AI responds in character based on what intel it's been given. `useStructured` generates mission briefings, intel reports, intercepted transmissions. Every playthrough is unique because the narrative is generated.

Your AI co-pilot watches your rack state, learns your style from session history, suggests compositions, and monitors threat levels. "The regime scanner is getting close to your frequency, shift to minor key and drop the tempo — they're pattern-matching high-energy broadcasts." It operates the same rack you do, through the same API.

### SQLite + Storage + CRUD — Persistent Intelligence

Your listener database. Intelligence files on the regime. Your song library. Decoded messages. Reputation scores with other stations. Agent roster, resources, territory, codebook — saved locally, carried in the binary. The AI stores its learned preferences here too.

### Text Editor + Spell Check — The Codebook

You write actual encryption ciphers in the in-game text editor. Simple substitution ciphers, more complex codes as you level up. Other players intercept your broadcasts and have to break your code using their own text editor. The code-breaking minigame is actual cryptanalysis.

Writing coded messages to other stations. Composing lyrics. Manifesto writing. Spell check matters because errors in coded transmissions change meaning in the cipher.

### HTTP Server + Media Library — Dead Drops

Your safehouse has a file dead-drop. An actual HTTP server runs on your node. You place files in a directory, other agents fetch them. Intel documents, maps, intercepted communications — real files served over real HTTP through Tor.

When you choose to go visible, you're literally serving your music catalog.

### Video Player — Propaganda and Intel

Intercepted regime propaganda you need to decode. Video dead drops from allied stations. Tutorial recordings from legendary DJs who went dark. Other players tune in and see real video playing. Cutscenes between missions are video files.

### Pixel Art — Station Identity

Your station's visual identity. Album art. Visual signals only other stations recognize.

### Charts + Tables + Sparkline + Progress Bars — Signal Analysis

Listener growth over time. Threat level dashboard. Frequency spectrum. Detection countdown. Regime patrol patterns plotted on a timeline. Intercepted communication logs — thousands of messages flowing through the network.

### Gamepad — Dual Mode Control

Two modes: live performance (triggers = velocity, sticks = filter sweep) and emergency evacuation (physically moving your station through the city when detected). Full gamepad navigation through every menu. On-screen keyboard for entering codes and messages when using a controller.

### Drag/Drop — Physical Intel Exchange

Import samples from your filesystem. Intelligence documents from other players. Map fragments. Real files moving between real filesystems.

### Clipboard — Out-of-Band Communication

Copy frequencies, coordinates, coded messages to share outside the game. The boundary between game and OS is intentionally porous.

### Context Menus — Operator Actions

Right-click any module, any contact, any track for actions. Rewire, encrypt, share, destroy.

### Hotkeys — Emergency Protocols

Emergency shutdown. Quick-broadcast. Frequency hop. Mute all. The keybindings are your muscle memory for operational security.

### Focus Groups + Tabs — Station Interface

Tab through your equipment rack, message queue, listener list. Switch between mixing desk, comms panel, intel view, codebook, black market.

### Modals + Portals — Urgent Events

Incoming transmissions. Urgent regime alerts. Decryption challenges that pop over your current view.

### Routing — Physical Spaces

Navigate between rooms: Studio, World Map, Intel Room, Listener Dashboard, Black Market, Safehouse, Codebook, Mission Briefing. Each is a full screen with its own layout.

### Badges + Cards — Dossiers

Station profiles. Contact cards with trust levels. Encrypted status indicators (on-air, stealth, scanning). Faction standings.

### Sliders + Switches + Select — The Mixing Desk

Every knob and fader on your mixing desk is a `<Slider>`. Encryption toggle is a `<Switch>`. Waveform selection is a `<Select>`.

### ScrollView + FlatList — Intel Feeds

Your song library. Message history. Intelligence archive. Listener list. Real-time network traffic scrolling past.

### Animations + Springs — The UI Breathes

Signal strength pulsing. Radio dial tuning. Waveform displays. Detection alert escalation. Alert indicators when your station is being traced.

### Code Block — Cryptanalysis

Decryption puzzles. Regime cipher analysis. Equipment configuration scripts.

### Browse — Electronic Intelligence

Scraping regime public channels for intel. Navigating fake websites that are puzzles to find hidden data.

### Inspector + Debug Overlay — In-Game Diagnostics

"Signal analyzer" and "equipment diagnostics." Same dev tools, different fiction.

## The Fourth Wall Doesn't Exist

The fiction and the infrastructure are the same object. You're not pretending to broadcast over Tor — you actually are. The audio engine isn't simulated — it's real DSP. The pirate radio station in the game IS a pirate radio station. The HTTP server IS serving real files. The encrypted messages use real cryptography.

## The Binary IS the Game

The game ships as a single binary. Your save state lives in local SQLite. The binary contains your Tor identity, your station configuration, your codebook, your intel. Trade binaries with other players to share intelligence — a binary from an allied player contains their knowledge.

~100 lines of application code on top of thousands of lines of framework that disappeared.

## The AI Music Co-Pilot (Extended Vision)

Beyond the spy game, SIGNAL's audio infrastructure enables a standalone creative tool: an AI-assisted music workstation where the agent learns your style.

The flow: you're jamming, tweaking the filter cutoff, layering oscillators — and the agent is watching the rack state stream (`audio:state` at 30fps). It sees your patterns. "This person always pulls the resonance up when they switch to saw wave." "They like slow attack times." "They tend to build toward a key change around bar 16." All stored in SQLite as structured preference data.

The collaboration:
- You twist a knob, the agent suggests a complementary change on another module
- You lay down a melody, the agent proposes a bass line by adding modules and connections to the rack
- You say "make it darker" in a text input, and the agent knows YOUR version of darker — lower cutoff, more reverb, minor key bias — because it learned that from your history

It's not a prompt box that generates audio files. It's a co-pilot that operates the same synth you're operating, in real time, through the same API. `rack.addModule()`, `rack.connect()`, `module.setParam()`. The agent's actions are visible, reversible, and happening right alongside yours.

## The Digital Radio (Extended Vision)

The broadcast infrastructure doubles as a censorship-resistant media platform:

- **The binary IS the radio.** `bin/tor` ships with the app. A Love2D binary with the audio engine, a bundled Tor client, and a hidden service address. You `./radio` and it connects. No browser, no app store, no CDN.
- **The station is just a rack streaming its output.** The engine fills a QueueableSource buffer at 44100Hz. Tee the final output to a Tor hidden service socket. Listeners connect, receive the PCM stream, feed it to their local QueueableSource.
- **The concert ticket IS a binary.** Compile a build with a specific `.onion` address and a time window baked in. Distribute however you want. If you have the binary, you have the show.
- **The UI is the venue.** The performer's rack state streams alongside the audio. You don't just hear the concert — you see the synth. The knobs moving, the connections being made. 400 bytes of JSON per frame instead of megabits of video.
- **Interaction goes both ways.** Listeners send MIDI events back. Crowd-sourced CC values. A thousand people each contributing one knob twist.

No server to take down, no DNS to seize, no API to rate-limit. The only way to stop the show is to stop every listener's local binary from running.
