---
title: Image
description: Display a raster image decoded by stb_image and cached as an SDL texture.
category: Primitives
keywords: image, src, texture, png, jpeg, bmp, gif, stb_image, photo
related: Box, Layout
difficulty: beginner
---

## Overview

`Image` loads a raster image from disk, decodes it with stb_image, uploads it to GPU memory as an SDL texture, and paints it into the node's computed bounds. The texture is cached by file path — the same image loaded in multiple places costs one decode and one GPU upload total. Explicit `width` and `height` in the `style` prop are required; without them the node has no computed size and nothing is painted.

## Syntax

```tsz
function App() {
  return (
    <Image src="./logo.png" style={{ width: 120, height: 120 }} />
  );
}
```

## Props / API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| src | `string` (string literal) | — | Path to the image file. Resolved relative to the `.tsz` source file at compile time. Baked in as an absolute path in the generated Zig. |
| style | StyleObject | `{}` | Flexbox layout + visual props. `width` and `height` are required. |
| className | `string` | — | Tailwind or Bootstrap class names, resolved at compile time. |
| debugName | `string` | — | Label shown in devtools overlays. Not rendered. |

## Supported Formats

stb_image supports: **PNG, JPEG, BMP, GIF** (first frame only for GIF). All images are decoded to RGBA (4 channels forced). The SDL texture format is `SDL_PIXELFORMAT_ABGR8888`.

## Examples

### Basic image

```tsz
function App() {
  return (
    <Box style={{ padding: 16, backgroundColor: '#1e1e2a' }}>
      <Image src="./photo.png" style={{ width: 200, height: 150 }} />
    </Box>
  );
}
```

### Image alongside text

```tsz
function App() {
  return (
    <Box style={{ flexDirection: 'row', gap: 16, padding: 16, backgroundColor: '#1e1e2a' }}>
      <Image src="./logo.png" style={{ width: 120, height: 133 }} />
      <Box style={{ flexDirection: 'column', gap: 8 }}>
        <Text fontSize={20} color="#ffffff">ReactJIT</Text>
        <Text fontSize={13} color="#888899">65KB native binary.</Text>
        <Text fontSize={13} color="#ff79c6">No runtime. No GC.</Text>
      </Box>
    </Box>
  );
}
```

### Image in a flex row with other elements

```tsz
function App() {
  return (
    <Box style={{ width: '100%', height: '100%', flexDirection: 'column', backgroundColor: '#16161e' }}>
      <Box style={{ flexDirection: 'row', gap: 12, padding: 12, alignItems: 'center' }}>
        <Image src="./avatar.png" style={{ width: 48, height: 48 }} />
        <Box style={{ flexDirection: 'column', gap: 4 }}>
          <Text fontSize={14} color="#ffffff">Jane Smith</Text>
          <Text fontSize={12} color="#888888">Online</Text>
        </Box>
      </Box>
    </Box>
  );
}
```

## Internals

The `src` attribute is a string literal parsed at compile time. The compiler resolves it to an absolute path relative to the `.tsz` source file and bakes that absolute path into the generated Zig as `.image_src = "/absolute/path/to/image.png"`. No path resolution happens at runtime.

At startup, the image cache (`ImageCache` in `image.zig`) is empty. When the painter encounters a node with `image_src` set, it calls `ImageCache.load(path)`. On the first call for a given path, stb_image decodes the file to an RGBA pixel buffer, an `SDL_Texture` is created with `SDL_TEXTUREACCESS_STATIC` and blend mode `SDL_BLENDMODE_BLEND`, the pixels are uploaded via `SDL_UpdateTexture`, and the entry is stored in a fixed-size array of 64 slots. On subsequent calls, the cached texture is returned immediately with no I/O.

The cache has no eviction policy. If 64 unique image paths are loaded, further loads return `null` and the image is not painted. Unused images from a previous render are not freed until the process exits.

Image dimensions (width × height in pixels) are also stored in the cache and fed back into the layout engine via `measureImageCallback` so that auto-sizing can work if needed — but explicit `width`/`height` in the style prop always takes precedence.

## Gotchas

- **`width` and `height` are required.** Without them the node has zero computed size and the image is not painted. There is no intrinsic-size auto-sizing from the image file dimensions in typical use.
- **`src` must be a string literal.** Dynamic paths (e.g. `src={someVariable}`) are not supported — the path is resolved and baked at compile time.
- **Paths are relative to the `.tsz` source file**, not the working directory at runtime. Moving the binary without its assets requires absolute paths or bundling assets alongside the binary.
- **The cache holds up to 64 images.** Applications loading more than 64 distinct image paths will silently fail to display images beyond that limit.
- **GIF is first-frame only.** There is no animation support.

## See Also

- [Box](./box.md)
- [Layout](../04-layout/index.md)
- [Runtime: Image Loading](../10-runtime/image.md)
