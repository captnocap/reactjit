# Rich Terminal: A Terminal Emulator That Isn't Stuck in 1978

## The Idea

A terminal emulator built on ReactJIT that treats the terminal as a first-class graphical surface. Text I/O is the default, but inline video playback, image rendering, and embedded web views are native — not hacks bolted onto a text grid. The shell is still a shell. It just isn't blind anymore.

## Why This Doesn't Exist Properly Yet

Every attempt at a "rich terminal" has been one of:

- **A terminal that can show images sometimes** — iTerm2, Kitty, Sixel support. The images are escape-code tricks painted over the text grid. They don't participate in layout. They don't scroll properly. They're hacks.
- **A web page pretending to be a terminal** — Hyper, Warp. Full Electron/Chromium underneath. You get web rendering but at the cost of being a 500 MB text editor.
- **A terminal with a sidebar for other stuff** — still two separate worlds that don't mix.

The problem is always the same: the text grid and the graphical content are two different systems fighting each other.

ReactJIT already solved this. `<Text>` and `<Image>` and `<Video>` live in the same layout tree. A terminal built on this framework doesn't need to hack images into a text grid — the text grid and the images are siblings in a flex layout.

## What It Looks Like

A normal terminal. You type commands, you see output. But:

- `cat photo.jpg` — the image renders inline, between the command and the next prompt, at a reasonable size, and scrolls with the output
- `mpv trailer.mp4` — video plays inline in the terminal output flow, with controls
- `curl https://example.com | browse` — a rendered web view appears inline, interactive, scrollable
- `ls *.png` — thumbnail previews next to filenames
- `git diff` — syntax-highlighted with actual color, not ANSI approximations
- `man ssh` — typeset like a real document, not a monospace wall

Everything is in the flow. No popups, no separate panes, no "press Q to exit the image viewer." The terminal output IS the document, and it can contain anything.

## Architecture

### The Shell Layer
- PTY (pseudo-terminal) allocation — the terminal emulator still runs a real shell (bash, zsh, fish)
- ANSI escape code parsing for standard terminal behavior — colors, cursor movement, alternate screen
- Raw text output flows into `<Text>` elements in the React tree

### The Rich Content Layer
- A protocol for inline content — when a command wants to emit rich content, it writes a structured escape sequence (like iTerm2's inline image protocol, but extended)
- The terminal intercepts these sequences and renders the appropriate React component — `<Image>`, `<Video>`, a web view, a chart, whatever
- Content participates in the same scroll and layout as text output

### The Rendering Layer
- Love2D renders everything — text, images, video (via libmpv), web content
- The entire terminal is one React component tree
- Scrollback buffer is virtualized — only visible content is rendered, but rich content is preserved in history

### Integration Protocol

Commands that want to emit rich content use a simple escape sequence wrapper:

```
\033]1337;type=image;src=inline;base64=...\007    # iTerm2-compatible images
\033]9001;type=video;src=/path/to/file.mp4\007    # Video playback
\033]9001;type=html;src=inline;base64=...\007     # Rendered HTML
\033]9001;type=component;name=chart;data=...\007  # React components
```

For backwards compatibility, standard ANSI output still works. The rich content is additive. Run this terminal with legacy commands and it's just a terminal.

## Components

### Terminal Core
```
<Terminal>
  <ScrollView height="100%" width="100%">
    <TerminalLine type="input">$ cat photo.jpg</TerminalLine>
    <TerminalLine type="rich">
      <Image src={photoData} width={400} />
    </TerminalLine>
    <TerminalLine type="input">$ echo hello</TerminalLine>
    <TerminalLine type="output">hello</TerminalLine>
    <TerminalLine type="input">$ play demo.mp4</TerminalLine>
    <TerminalLine type="rich">
      <Video src="demo.mp4" width="100%" controls />
    </TerminalLine>
    <PromptLine />
  </ScrollView>
</Terminal>
```

Every line of terminal output is a React element. Rich content is just a different element type in the same list. Scrolling, selection, copy-paste — all unified.

### Split Panes
Terminal multiplexing (like tmux) but native:
```
<SplitView direction="row">
  <Terminal flex={1} />
  <Terminal flex={1} />
</SplitView>
```

Each pane is an independent terminal instance with its own PTY. Layout is flexbox. Resize by dragging. No tmux escape sequences, no prefix keys, just mouse and keyboard.

### Inline Web View
For rendering HTML content inline:
- Could use a lightweight HTML/CSS renderer
- Or embed a web view component for full fidelity
- The web content lives inside the terminal scroll flow, not in a separate window

## What This Enables

### For Developers
- `docker stats` but with actual charts inline
- `git log` with commit graph rendered as actual vector graphics, not ASCII art
- Test runners that show failure screenshots inline
- API testing tools that render response bodies as formatted, interactive documents

### For Data Work
- Plot output from Python/R renders inline as a real chart, not a Sixel blob
- DataFrames render as styled, scrollable tables
- Jupyter-style workflow but in your terminal — code, output, visualization, all in the scroll

### For General Use
- File managers with real thumbnails
- Image/video preview without leaving the terminal
- Documentation with proper formatting, diagrams, and embedded examples
- Chat/messaging in the terminal with inline images and media

## What Makes This Different

**Kitty/iTerm2** can show images but they're painted over the text grid as rectangular regions. They don't flow with text, they don't resize properly, they don't compose with other content. They're escape code hacks on a 1978 architecture.

**Warp** went the other direction — build a terminal as a web app. You get rich rendering but you're running Chromium to display text. The overhead is absurd.

**This approach** keeps the terminal as a native rendered surface (Love2D, fast, lightweight) where text and rich content are peers in the same layout system. No Chromium tax. No escape code hacks. The terminal IS a React app that happens to run a shell.

## The Packaging Story

Same as the other concepts. The terminal emulator itself is a `dist:love` binary:

```
[shell stub] + [compressed tarball containing:]
  ├── love2d runtime + glibc
  ├── lua/ runtime + libmpv
  ├── bundle.js (terminal React UI)
  ├── config.json (keybindings, themes, shell preference)
  └── themes/ (color schemes, fonts)
```

~50 MB for a terminal emulator with inline video, image, and rich content support. Versus ~200 MB+ for Electron-based terminals that can't even play video.

## Open Questions

- **PTY management in Love2D/Lua** — need to spawn and manage pseudo-terminals. LuaJIT FFI can call `forkpty()` / `openpty()` directly on Linux. Cross-platform PTY abstraction would be needed for macOS/Windows.
- **Text rendering performance** — terminals output a LOT of text. The ReactJIT text measurement and rendering pipeline needs to handle thousands of lines efficiently. Virtualized scrollback is mandatory.
- **Selection and copy-paste** — selecting text that flows around inline images/video. Non-trivial UX problem.
- **ANSI compatibility** — how much of the VT100/xterm escape sequence zoo to support. Full compatibility is a rabbit hole but necessary for real-world use (vim, less, htop, etc.).
- **Font rendering** — terminals need monospace, ligatures, powerline glyphs, Nerd Font icons. Love2D's text rendering needs to handle all of this.
- **The web view question** — inline HTML rendering is the hardest piece. A lightweight markdown/HTML renderer might be enough for most cases without embedding a full browser engine.
