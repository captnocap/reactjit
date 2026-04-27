# SDK Dependency Registry

`sdk/dependency-registry.json` is the build contract for the packed CLI. It
lists every tool and dependency the CLI must carry, and maps source usage to
the build options, V8 bindings, and native libraries that may be linked.

## Two-axis policy

Every native library has both a `linkPolicy` and a `bundlePolicy`. They are
independent because **declaring a link** and **shipping the .so** are
different decisions.

`linkPolicy`:
- `foundational` — every cart's build.zig declares the link unconditionally
  (SDL3, freetype, wgpu-native, luajit, stb-image*).
- `system-assumed` — declared at link time but the host always provides it
  (X11, libc/libm/libpthread/libdl, macOS Foundation/QuartzCore/Metal/etc.).
- `feature-gated` — declared only when the cart's source triggers the
  feature (libmpv, libsodium, libsqlite3, libvterm, box2d, libcurl, tls.zig).
- `engine-v8` — V8 prebuilt static library; selected via `-Duse-v8`.

`bundlePolicy`:
- `always` — pack-sdk always copies the .so into the SDK payload (SDL3,
  freetype, luajit, wgpu-native .a, V8 .a).
- `feature-gated` — pack-sdk only copies it when the feature is enabled.
- `vendored-source` — compiled from C source in this repo, no .so to ship
  (stb-image, stb-image-write).
- `never` — host-provided, never packed (X11, posix-threading,
  macos-ui-frameworks).

Macros: foundational+always = "we pin the version, so we ship it." system-
assumed+never = "the host has this, we link against the system copy."

The rule is strict: a feature is linked only when one of its triggers is present
in the esbuild metafile's `outputs[].inputs` set, or when the feature is a CLI
payload requirement such as `zig`, `v8cli`, `esbuild`, or the React runtime.

`scripts/sdk-dependency-resolve.js` is runnable with `tools/v8cli`:

```sh
tools/v8cli scripts/sdk-dependency-resolve.js --metafile bundle-hello.js.metafile.json
tools/v8cli scripts/sdk-dependency-resolve.js --metafile bundle-hello.js.metafile.json --format ship-gate
tools/v8cli scripts/sdk-dependency-resolve.js --metafile bundle-hello.js.metafile.json --format zig-flags
tools/v8cli scripts/sdk-dependency-resolve.js --format dev-zig-flags
```

`ship-gate` preserves the existing positional output expected by `scripts/ship`.
`zig-flags` emits `-D...=true` flags for `zig build`. The JSON output is the
broader interface for teaching `build.zig` which native libraries to link and
for teaching the packed CLI which payload files are mandatory.

`dev-zig-flags` is different on purpose: it enables every registry feature that
`build.zig` currently declares. The hot-bundle dev host must be a fat binary,
because it can receive any cart after startup.

Primitive-level native features use `featureMarker` triggers. Those marker
inputs must be emitted by the primitive wrappers or generated runtime files so a
cart that never imports `Video`, `Canvas`, `Terminal`, or similar features does
not carry their native libraries.
