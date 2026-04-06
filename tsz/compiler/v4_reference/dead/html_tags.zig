//! HTML tag → .tsz primitive resolution.
//!
//! Maps standard HTML element names to their .tsz primitive equivalents.
//! Used by jsx.zig, jsx_map.zig, and validate.zig to accept HTML tags natively.

const std = @import("std");

/// HTML tag to primitive mapping table.
/// Order doesn't matter — this is searched linearly with comptime unrolling.
const html_map = .{
    // Containers → Box
    .{ "div", "Box" },
    .{ "section", "Box" },
    .{ "article", "Box" },
    .{ "main", "Box" },
    .{ "aside", "Box" },
    .{ "header", "Box" },
    .{ "footer", "Box" },
    .{ "nav", "Box" },
    .{ "form", "Box" },
    .{ "fieldset", "Box" },
    .{ "figure", "Box" },
    .{ "figcaption", "Box" },
    .{ "details", "Box" },
    .{ "summary", "Box" },
    .{ "dialog", "Box" },
    .{ "ul", "Box" },
    .{ "ol", "Box" },
    .{ "li", "Box" },
    .{ "dl", "Box" },
    .{ "dd", "Box" },
    .{ "dt", "Box" },
    .{ "table", "Box" },
    .{ "thead", "Box" },
    .{ "tbody", "Box" },
    .{ "tr", "Box" },
    .{ "td", "Box" },
    .{ "th", "Box" },

    // Text → Text
    .{ "span", "Text" },
    .{ "p", "Text" },
    .{ "label", "Text" },
    .{ "h1", "Text" },
    .{ "h2", "Text" },
    .{ "h3", "Text" },
    .{ "h4", "Text" },
    .{ "h5", "Text" },
    .{ "h6", "Text" },
    .{ "strong", "Text" },
    .{ "em", "Text" },
    .{ "b", "Text" },
    .{ "i", "Text" },
    .{ "u", "Text" },
    .{ "small", "Text" },
    .{ "code", "Text" },
    .{ "pre", "Text" },
    .{ "blockquote", "Text" },
    .{ "a", "Text" },
    .{ "time", "Text" },
    .{ "abbr", "Text" },
    .{ "cite", "Text" },
    .{ "mark", "Text" },
    .{ "sub", "Text" },
    .{ "sup", "Text" },
    .{ "del", "Text" },
    .{ "ins", "Text" },
    .{ "kbd", "Text" },
    .{ "samp", "Text" },

    // Interactive → Pressable
    .{ "button", "Pressable" },

    // Media → Image
    .{ "img", "Image" },

    // Input → TextInput
    .{ "input", "TextInput" },
    .{ "textarea", "TextInput" },

    // Passthrough (SVG, video, audio → Box)
    .{ "svg", "Box" },
    .{ "video", "Box" },
    .{ "audio", "Box" },
    .{ "select", "Box" },
};

/// Resolve an HTML tag name to its .tsz primitive equivalent.
/// Returns the primitive name if matched, or null if not an HTML tag.
pub fn resolve(tag: []const u8) ?[]const u8 {
    inline for (html_map) |entry| {
        if (std.mem.eql(u8, tag, entry[0])) return entry[1];
    }
    return null;
}

/// Check if a tag name is a known HTML tag.
pub fn isHtmlTag(tag: []const u8) bool {
    return resolve(tag) != null;
}
