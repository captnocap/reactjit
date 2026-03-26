//! Surface Manifest — single source of truth for all user-facing surfaces.
//!
//! Every JSX tag, sub-surface, and callable namespace is defined here.
//! The compiler reads this for validation (validate.zig) and tiering.
//! The runtime will consume it later for field generation.
//!
//! Taxonomy:
//!   primitive — leaf rendering elements (Box, Text, Image, ...)
//!   system   — containers that own subsystems (Canvas, Physics, Scene3D, ...)
//!   package  — pure-function namespaces, no JSX tags (Math, Vec2, Noise, ...)

/// Surface tier. Determines how the compiler/runtime treats the tag.
pub const Tier = enum {
    /// Leaf rendering. Universal availability. No subsystem state.
    primitive,
    /// Container with sub-surfaces. Owns runtime state (camera, world, etc.).
    system,
    /// Callable namespace. Not a JSX tag. Available in expressions/scripts.
    package,
};

/// A sub-surface within a system (e.g. Canvas.Node, Physics.Body).
pub const SubSurface = struct {
    name: []const u8,
    doc: []const u8 = "",
};

/// A user-facing surface definition.
pub const Surface = struct {
    tag: []const u8,
    tier: Tier,
    sub_surfaces: []const SubSurface = &.{},
    runtime_module: []const u8 = "",
    doc: []const u8 = "",
};

// ════════════════════════════════════════════════════════════════════════
// Core Primitives
// ════════════════════════════════════════════════════════════════════════

const box = Surface{
    .tag = "Box",
    .tier = .primitive,
    .runtime_module = "layout.zig",
    .doc = "Generic flex container. The fundamental layout building block.",
};

const text = Surface{
    .tag = "Text",
    .tier = .primitive,
    .runtime_module = "text.zig",
    .doc = "Text display with font, color, and wrapping support.",
};

const image = Surface{
    .tag = "Image",
    .tier = .primitive,
    .runtime_module = "gpu/images.zig",
    .doc = "Image display from src path. Decoded to GPU texture.",
};

const video = Surface{
    .tag = "Video",
    .tier = .primitive,
    .runtime_module = "videos.zig",
    .doc = "Video playback surface.",
};

const render = Surface{
    .tag = "Render",
    .tier = .primitive,
    .runtime_module = "render_surfaces.zig",
    .doc = "Custom render target for offscreen/VM rendering.",
};

const pressable = Surface{
    .tag = "Pressable",
    .tier = .primitive,
    .runtime_module = "events.zig",
    .doc = "Touch/click target. Wraps children with onPress handler.",
};

const scroll_view = Surface{
    .tag = "ScrollView",
    .tier = .primitive,
    .runtime_module = "layout.zig",
    .doc = "Scrollable content area. Needs explicit height.",
};

const text_input = Surface{
    .tag = "TextInput",
    .tier = .primitive,
    .runtime_module = "input.zig",
    .doc = "Single-line text input with onChange/onSubmit.",
};

const text_area = Surface{
    .tag = "TextArea",
    .tier = .primitive,
    .runtime_module = "input.zig",
    .doc = "Multi-line text input.",
};

const glyph = Surface{
    .tag = "Glyph",
    .tier = .primitive,
    .runtime_module = "layout.zig",
    .doc = "Inline polygon/3D glyph inside Text. Scales with fontSize.",
};

const cartridge = Surface{
    .tag = "Cartridge",
    .tier = .primitive,
    .runtime_module = "cartridge.zig",
    .doc = "Embedded .so app loaded at runtime via dlopen.",
};

// ════════════════════════════════════════════════════════════════════════
// Systems
// ════════════════════════════════════════════════════════════════════════

const canvas = Surface{
    .tag = "Canvas",
    .tier = .system,
    .sub_surfaces = &.{
        .{ .name = "Node", .doc = "Positioned child in canvas graph-space (gx, gy, gw, gh)." },
        .{ .name = "Path", .doc = "SVG path drawing with stroke/fill in canvas coordinates." },
        .{ .name = "Clamp", .doc = "Viewport-pinned overlay (stays fixed while canvas pans)." },
    },
    .runtime_module = "canvas.zig",
    .doc = "Pannable/zoomable 2D canvas with camera, paths, and positioned nodes.",
};

const graph = Surface{
    .tag = "Graph",
    .tier = .system,
    .sub_surfaces = &.{
        .{ .name = "Node", .doc = "Positioned node in graph space." },
        .{ .name = "Path", .doc = "SVG path in graph coordinates. No pan/zoom." },
    },
    .runtime_module = "svg_path.zig",
    .doc = "Lightweight SVG path container for charts. No pan/zoom/drag.",
};

const physics = Surface{
    .tag = "Physics",
    .tier = .system,
    .sub_surfaces = &.{
        .{ .name = "World", .doc = "Box2D world container with gravity." },
        .{ .name = "Body", .doc = "Rigid body (static/kinematic/dynamic) wrapping child nodes." },
        .{ .name = "Collider", .doc = "Shape definition (rect/circle) without visual." },
    },
    .runtime_module = "physics2d.zig",
    .doc = "2D physics via Box2D. Bodies sync positions to layout nodes each frame.",
};

const scene3d = Surface{
    .tag = "Scene3D",
    .tier = .system,
    .runtime_module = "gpu/3d.zig",
    .doc = "3D scene container. Children use 3D.* sub-surfaces.",
};

const three_d = Surface{
    .tag = "3D",
    .tier = .system,
    .sub_surfaces = &.{
        .{ .name = "Camera", .doc = "Scene camera with position, lookAt, fov." },
        .{ .name = "Light", .doc = "Light source (ambient/directional/point)." },
        .{ .name = "Mesh", .doc = "3D geometry (box/sphere/plane/cylinder/torus/cone)." },
        .{ .name = "Group", .doc = "Transform group for child meshes." },
        .{ .name = "Body", .doc = "Bullet rigid body wrapping a mesh." },
        .{ .name = "Physics", .doc = "Bullet physics world with 3D gravity." },
    },
    .runtime_module = "physics3d.zig",
    .doc = "3D sub-surfaces used inside Scene3D. Rendered by gpu/3d.zig.",
};

const effect = Surface{
    .tag = "Effect",
    .tier = .system,
    .runtime_module = "effects.zig",
    .doc = "Pixel-buffer effect with onRender callback. CPU pixels to GPU texture.",
};

const terminal = Surface{
    .tag = "Terminal",
    .tier = .system,
    .runtime_module = "vterm.zig",
    .doc = "Cell-grid terminal rendering via libvterm.",
};

const audio = Surface{
    .tag = "Audio",
    .tier = .system,
    .sub_surfaces = &.{
        .{ .name = "Oscillator", .doc = "Waveform generator (sine/saw/square/triangle/noise)." },
        .{ .name = "Filter", .doc = "Audio filter (lowpass/highpass/bandpass)." },
        .{ .name = "Gain", .doc = "Volume control node." },
        .{ .name = "Analyzer", .doc = "FFT/waveform analyzer for visualization." },
    },
    .runtime_module = "audio.zig",
    .doc = "Audio graph via SDL3 + LuaJIT DSP. Virtual audio nodes.",
};

// ════════════════════════════════════════════════════════════════════════
// Packages (callable namespaces, not JSX tags)
// ════════════════════════════════════════════════════════════════════════

const math_pkg = Surface{
    .tag = "Math",
    .tier = .package,
    .runtime_module = "math.zig",
    .doc = "Standard math: abs, max, min, floor, ceil, sqrt, sin, cos, tan, atan2, pow, log, exp, PI, E, clamp, lerp, random.",
};

const vec2_pkg = Surface{
    .tag = "Vec2",
    .tier = .package,
    .runtime_module = "math.zig",
    .doc = "2D vector: constructor, add, sub, scale, normalize, distance, dot, cross, lerp, angle, rotate.",
};

const vec3_pkg = Surface{
    .tag = "Vec3",
    .tier = .package,
    .runtime_module = "math.zig",
    .doc = "3D vector: constructor, add, sub, scale, normalize, distance, dot, cross, lerp.",
};

const noise_pkg = Surface{
    .tag = "Noise",
    .tier = .package,
    .runtime_module = "math.zig",
    .doc = "Noise functions: perlin2d, perlin3d, fbm, voronoi.",
};

const random_pkg = Surface{
    .tag = "Random",
    .tier = .package,
    .runtime_module = "random.zig",
    .doc = "Deterministic PRNG: float, range, int, seed.",
};

const spring_pkg = Surface{
    .tag = "Spring",
    .tier = .package,
    .runtime_module = "easing.zig",
    .doc = "Spring physics: step, config.",
};

const geometry_pkg = Surface{
    .tag = "Geometry",
    .tier = .package,
    .runtime_module = "math.zig",
    .doc = "Geometric queries: distance, angle, intersect, contains, bezier.",
};

// ════════════════════════════════════════════════════════════════════════
// Aggregate tables — consumed by compiler and runtime
// ════════════════════════════════════════════════════════════════════════

/// All JSX-renderable surfaces (primitives + systems). Used by validate.zig.
pub const all_tags: []const Surface = &.{
    // Primitives
    box, text, image, video, render, pressable, scroll_view,
    text_input, text_area, glyph, cartridge,
    // Systems
    canvas, graph, physics, scene3d, three_d, effect, terminal, audio,
};

/// Package namespaces (callable, not JSX tags).
pub const all_packages: []const Surface = &.{
    math_pkg, vec2_pkg, vec3_pkg, noise_pkg, random_pkg, spring_pkg, geometry_pkg,
};

/// Everything.
pub const all_surfaces: []const Surface = all_tags ++ all_packages;

// ════════════════════════════════════════════════════════════════════════
// Comptime queries — used by validate.zig, jsx.zig
// ════════════════════════════════════════════════════════════════════════

/// Check if a name is a valid JSX primitive or system tag.
pub fn isTag(name: []const u8) bool {
    for (all_tags) |s| {
        if (eql(s.tag, name)) return true;
    }
    return false;
}

/// Check if a name is a system tag (has sub-surfaces or runtime subsystem).
pub fn isSystem(name: []const u8) bool {
    for (all_tags) |s| {
        if (s.tier == .system and eql(s.tag, name)) return true;
    }
    return false;
}

/// Check if a name is a package namespace (callable, not a JSX tag).
pub fn isPackage(name: []const u8) bool {
    for (all_packages) |s| {
        if (eql(s.tag, name)) return true;
    }
    return false;
}

/// Look up a surface by tag name.
pub fn get(name: []const u8) ?Surface {
    for (all_surfaces) |s| {
        if (eql(s.tag, name)) return s;
    }
    return null;
}

/// Check if tag.sub is a valid sub-surface (e.g. "Canvas" + "Node").
pub fn isSubSurface(tag: []const u8, sub: []const u8) bool {
    for (all_tags) |s| {
        if (eql(s.tag, tag)) {
            for (s.sub_surfaces) |ss| {
                if (eql(ss.name, sub)) return true;
            }
            return false;
        }
    }
    return false;
}

/// Generate a comptime list of all tag name strings (for backward compat).
pub fn tagNames() [all_tags.len][]const u8 {
    var names: [all_tags.len][]const u8 = undefined;
    for (all_tags, 0..) |s, i| {
        names[i] = s.tag;
    }
    return names;
}

fn eql(a: []const u8, b: []const u8) bool {
    if (a.len != b.len) return false;
    for (a, b) |ac, bc| {
        if (ac != bc) return false;
    }
    return true;
}
