# Digital DVD: Self-Contained Video Appliances

## The Idea

Same principle as the AI appliance — compile media into a single executable. A movie, a series, a collection of videos packaged into one file with a menu system, chapter navigation, scene selection, and playback controls. A DVD, but it's a binary. No player required. Double-click it, you're watching.

## What the User Sees

1. Open the **authoring tool** (ReactJIT binary)
2. Drop in video files
3. Define the structure:
   - Title screen / main menu
   - Chapter markers and scene timestamps
   - Episode ordering (for series)
   - Background art, menu music
   - Subtitle tracks
4. Customize the menu UI — layout, colors, transitions, animations
5. Hit **Export**
6. Out comes a single file: `my-film.bin` — a self-playing movie with full DVD-style navigation

## What's Inside the Binary

| Component | Size | Role |
|-----------|------|------|
| Love2D runtime + Lua + QuickJS | ~30 MB | Renderer, UI, menu system |
| FFmpeg shared libraries | ~15 MB | Video/audio decoding |
| React UI bundle | KB | Menu screens, player controls, scene selector |
| Menu config (structured data) | KB | Chapter markers, scene list, layout definitions |
| Menu assets (images, music) | MB | Background art, thumbnails, audio |
| Video files | GB | The actual content |

## The Menu System

This is where ReactJIT earns its keep. The menu isn't a static image like a real DVD — it's a live React UI rendered by Love2D:

- **Animated backgrounds** — particles, shaders, moving artwork
- **Scene selection grids** — thumbnail previews pulled from chapter timestamps
- **Episode browsers** — for series, scroll through seasons and episodes
- **Settings** — subtitle track, audio track, playback quality
- **Resume playback** — persist watch position to a local dotfile
- **Easter eggs** — hidden menus, unlock sequences, interactive elements

All built with the same `<Box>`, `<Text>`, `<Image>`, `<Pressable>` primitives. Authors design their DVD menus in React.

## Config Format

```json
{
  "title": "My Film",
  "type": "movie",
  "menu": {
    "background": "assets/menu-bg.png",
    "music": "assets/menu-theme.ogg",
    "layout": "cinematic"
  },
  "media": [
    {
      "file": "film.mp4",
      "title": "Main Feature",
      "chapters": [
        { "time": "0:00", "title": "Opening" },
        { "time": "12:34", "title": "Act One" },
        { "time": "45:00", "title": "Intermission" },
        { "time": "1:02:15", "title": "Act Two" },
        { "time": "1:45:00", "title": "Finale" }
      ],
      "subtitles": [
        { "lang": "en", "file": "subs/english.srt" },
        { "lang": "es", "file": "subs/spanish.srt" }
      ]
    }
  ]
}
```

For a series:

```json
{
  "title": "My Show",
  "type": "series",
  "seasons": [
    {
      "title": "Season 1",
      "episodes": [
        {
          "file": "s01e01.mp4",
          "title": "Pilot",
          "duration": "42:00",
          "thumbnail": "thumbs/s01e01.jpg",
          "chapters": [...]
        }
      ]
    }
  ]
}
```

## Technical Architecture

### Video Playback
- **FFmpeg** compiled as shared libraries, loaded via Lua FFI
- Decode video frames to textures, render them as `<Image>` elements or directly to the Love2D canvas
- Audio decoded and played through Love2D's audio system or FFmpeg's audio output
- Subtitle rendering is just `<Text>` overlaid on the video frame — already solved

### The Playback Surface
Video plays inside the same rendering pipeline as everything else. A video frame is just an image that updates 24/30/60 times per second. The React UI renders on top of it — player controls, subtitles, chapter indicators. Pause the video and the menu system takes over. It's all one scene graph.

### Build Pipeline
Extends `dist:love` the same way the AI appliance does:

```
[shell stub] + [compressed tarball containing:]
  ├── love2d runtime + glibc
  ├── lua/ runtime
  ├── libavcodec.so, libavformat.so, etc.
  ├── bundle.js (React menu UI)
  ├── config.json (structure, chapters, metadata)
  ├── assets/ (menu art, thumbnails, music)
  └── media/ (video files, subtitle tracks)
```

### Compression Considerations
- Video files are already compressed (H.264/H.265) — don't double-compress them in the tarball
- Store video files uncompressed in the archive, compress everything else
- Or use a container format that supports mixed compression (some entries compressed, some stored raw)

## What Makes This Different from VLC + a Folder

**Curation.** A folder of `.mp4` files is just files. A digital DVD is an authored experience — menus, chapter navigation, artwork, flow. The same difference between a pile of MP3s and a vinyl record with liner notes.

**Portability.** One file. No "which player do I open this with." No codec packs. No missing subtitle files. No broken relative paths. It runs.

**Customization.** The menu system is React. You're not limited to DVD Studio Pro's template library from 2004. Animated shaders, interactive elements, generative art on the title screen — whatever you can build in ReactJIT.

## Use Cases

- **Independent filmmakers** — distribute your film as a single file with a polished menu experience, no platform middleman
- **Video essays / series** — package a multi-part series with proper navigation instead of a YouTube playlist
- **Conference talks** — all talks from an event in one binary with a speaker/topic browser
- **Personal archives** — family videos with a nice menu, chapter markers at key moments, runs on any machine decades from now
- **Education** — course materials as a single navigable binary, lectures organized by module
- **Art installations** — a looping video piece with an interactive menu, runs on any Linux box

## Stretch Goals

- **Commentary tracks** — multiple audio streams, switchable during playback (like a real DVD)
- **Bonus features menu** — behind the scenes, deleted scenes, director's commentary, all structured in the config
- **Bookmarks** — user can mark favorite moments, persisted locally
- **Export chapters as clips** — pull out a scene as a standalone file
- **Network streaming** — same dual-mode idea from the AI appliance: the binary also serves its video content over HTTP for other devices on the LAN

## Open Questions

- **Video decoding in Love2D** — Love2D has `love.graphics.newVideo` for Theora. For H.264/H.265, you'd need FFmpeg integration via Lua FFI or a Love2D plugin. This is the main technical unknown.
- **Seeking performance** — scrubbing through a large video embedded in a tarball-based binary. Might need the video stored at a known byte offset for direct access without full extraction.
- **DRM** — intentionally not addressed. This is about authoring and distribution, not restriction. But the encrypted container idea from the AI appliance concept could apply here if someone wanted it.
- **Windows/macOS** — same platform packaging question as the AI appliance. Linux is free, other platforms need their own formats.
