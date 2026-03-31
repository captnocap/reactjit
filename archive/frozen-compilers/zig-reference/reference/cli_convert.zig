//! tsz convert <file.html|file.tsx> — Convert HTML/React to .tsz
//!
//! Tag mappings:
//!   div, section, article, nav, main, header, footer → Box
//!   span, p, h1-h6, label, strong, em                → Text
//!   img                                               → Image
//!   button, a                                         → Pressable
//!   input, textarea                                   → TextInput
//!   ul, ol, li                                        → Box
//!
//! Inline style → style={{...}} props. className ignored (use classifiers).
//! Output to stdout or --output file.

const std = @import("std");

pub fn run(alloc: std.mem.Allocator, args: []const []const u8) void {
    var input_path: ?[]const u8 = null;
    var output_path: ?[]const u8 = null;

    var i: usize = 2;
    while (i < args.len) : (i += 1) {
        if (std.mem.eql(u8, args[i], "--output") or std.mem.eql(u8, args[i], "-o")) {
            i += 1;
            if (i < args.len) output_path = args[i];
        } else {
            input_path = args[i];
        }
    }

    if (input_path == null) {
        std.debug.print("Usage: zigos-compiler convert [--output file.tsz] <file.html|file.tsx>\n", .{});
        return;
    }

    const source = std.fs.cwd().readFileAlloc(alloc, input_path.?, 2 * 1024 * 1024) catch |err| {
        std.debug.print("[tsz] Error reading {s}: {}\n", .{ input_path.?, err });
        return;
    };

    var out = std.ArrayListUnmanaged(u8){};

    // Detect if HTML or TSX/JSX
    const is_html = std.mem.endsWith(u8, input_path.?, ".html") or std.mem.endsWith(u8, input_path.?, ".htm");

    if (is_html) {
        convertHtml(alloc, source, &out);
    } else {
        convertTsx(alloc, source, &out);
    }

    // Wrap in App function if we have content
    if (out.items.len > 0) {
        var result = std.ArrayListUnmanaged(u8){};
        result.appendSlice(alloc, "// Converted from ") catch return;
        result.appendSlice(alloc, std.fs.path.basename(input_path.?)) catch return;
        result.appendSlice(alloc, "\n\nfunction App() {\n  return (\n") catch return;
        result.appendSlice(alloc, out.items) catch return;
        result.appendSlice(alloc, "  );\n}\n") catch return;

        if (output_path) |op| {
            const f = std.fs.cwd().createFile(op, .{}) catch |err| {
                std.debug.print("[tsz] Error creating {s}: {}\n", .{ op, err });
                return;
            };
            defer f.close();
            f.writeAll(result.items) catch return;
            std.debug.print("[tsz] Converted {s} -> {s}\n", .{ std.fs.path.basename(input_path.?), op });
        } else {
            _ = std.posix.write(std.posix.STDOUT_FILENO, result.items) catch return;
        }
    }
}

// ── HTML conversion ─────────────────────────────────────────────────

fn convertHtml(alloc: std.mem.Allocator, source: []const u8, out: *std.ArrayListUnmanaged(u8)) void {
    var pos: usize = 0;
    var indent: usize = 4;

    while (pos < source.len) {
        // Skip whitespace
        while (pos < source.len and (source[pos] == ' ' or source[pos] == '\n' or source[pos] == '\r' or source[pos] == '\t')) pos += 1;
        if (pos >= source.len) break;

        if (source[pos] == '<') {
            if (pos + 1 < source.len and source[pos + 1] == '/') {
                // Closing tag — skip it, reduce indent
                while (pos < source.len and source[pos] != '>') pos += 1;
                if (pos < source.len) pos += 1;
                if (indent >= 6) indent -= 2;
            } else if (pos + 1 < source.len and source[pos + 1] == '!') {
                // Comment or DOCTYPE — skip
                while (pos < source.len and source[pos] != '>') pos += 1;
                if (pos < source.len) pos += 1;
            } else {
                // Opening tag
                pos += 1; // skip <
                const tag_start = pos;
                while (pos < source.len and source[pos] != ' ' and source[pos] != '>' and source[pos] != '/' and source[pos] != '\n') pos += 1;
                const html_tag = source[tag_start..pos];

                // Skip tags we don't convert
                if (std.mem.eql(u8, html_tag, "html") or std.mem.eql(u8, html_tag, "head") or
                    std.mem.eql(u8, html_tag, "body") or std.mem.eql(u8, html_tag, "meta") or
                    std.mem.eql(u8, html_tag, "link") or std.mem.eql(u8, html_tag, "title") or
                    std.mem.eql(u8, html_tag, "script") or std.mem.eql(u8, html_tag, "style") or
                    std.mem.eql(u8, html_tag, "br") or std.mem.eql(u8, html_tag, "hr"))
                {
                    while (pos < source.len and source[pos] != '>') pos += 1;
                    if (pos < source.len) pos += 1;
                    // For script/style, skip content until closing tag
                    if (std.mem.eql(u8, html_tag, "script") or std.mem.eql(u8, html_tag, "style")) {
                        while (pos < source.len) {
                            if (source[pos] == '<' and pos + 1 < source.len and source[pos + 1] == '/') break;
                            pos += 1;
                        }
                        while (pos < source.len and source[pos] != '>') pos += 1;
                        if (pos < source.len) pos += 1;
                    }
                    continue;
                }

                const tsz_tag = mapHtmlTag(html_tag);

                // Parse inline style if present
                var style_str: ?[]const u8 = null;
                var is_self_closing = false;

                while (pos < source.len and source[pos] != '>' and source[pos] != '/') {
                    if (pos < source.len and source[pos] == ' ') {
                        pos += 1;
                        continue;
                    }
                    // Check for style="..."
                    if (pos + 6 < source.len and std.mem.eql(u8, source[pos..][0..6], "style=")) {
                        pos += 6;
                        if (pos < source.len and source[pos] == '"') {
                            pos += 1;
                            const style_start = pos;
                            while (pos < source.len and source[pos] != '"') pos += 1;
                            style_str = convertInlineStyle(alloc, source[style_start..pos]);
                            if (pos < source.len) pos += 1;
                        }
                    } else {
                        // Skip other attributes
                        while (pos < source.len and source[pos] != ' ' and source[pos] != '>' and source[pos] != '/') {
                            if (source[pos] == '"') {
                                pos += 1;
                                while (pos < source.len and source[pos] != '"') pos += 1;
                                if (pos < source.len) pos += 1;
                            } else {
                                pos += 1;
                            }
                        }
                    }
                }

                if (pos < source.len and source[pos] == '/') {
                    is_self_closing = true;
                    pos += 1;
                }
                if (pos < source.len and source[pos] == '>') pos += 1;

                // Emit opening tag
                writeIndent(alloc, out, indent);
                out.appendSlice(alloc, "<") catch return;
                out.appendSlice(alloc, tsz_tag) catch return;
                if (style_str) |s| {
                    out.appendSlice(alloc, " style={{ ") catch return;
                    out.appendSlice(alloc, s) catch return;
                    out.appendSlice(alloc, " }}") catch return;
                }
                if (is_self_closing) {
                    out.appendSlice(alloc, " />\n") catch return;
                } else if (isTextTag(html_tag)) {
                    // For text tags, grab text content inline
                    const text_start = pos;
                    while (pos < source.len and source[pos] != '<') pos += 1;
                    const text = std.mem.trim(u8, source[text_start..pos], " \n\r\t");
                    if (text.len > 0) {
                        out.appendSlice(alloc, ">") catch return;
                        out.appendSlice(alloc, text) catch return;
                        out.appendSlice(alloc, "</") catch return;
                        out.appendSlice(alloc, tsz_tag) catch return;
                        out.appendSlice(alloc, ">\n") catch return;
                    } else {
                        out.appendSlice(alloc, " />\n") catch return;
                    }
                    // Skip closing tag
                    while (pos < source.len and source[pos] != '>') pos += 1;
                    if (pos < source.len) pos += 1;
                } else {
                    out.appendSlice(alloc, ">\n") catch return;
                    indent += 2;
                }
            }
        } else {
            // Text content outside tags
            const text_start = pos;
            while (pos < source.len and source[pos] != '<') pos += 1;
            const text = std.mem.trim(u8, source[text_start..pos], " \n\r\t");
            if (text.len > 0) {
                writeIndent(alloc, out, indent);
                out.appendSlice(alloc, "<Text>") catch return;
                out.appendSlice(alloc, text) catch return;
                out.appendSlice(alloc, "</Text>\n") catch return;
            }
        }
    }
}

// ── TSX/JSX conversion ──────────────────────────────────────────────

fn convertTsx(alloc: std.mem.Allocator, source: []const u8, out: *std.ArrayListUnmanaged(u8)) void {
    // Simple approach: find the return ( ... ) block and convert tags
    // Look for "return (" or "return(<"
    var pos: usize = 0;
    var found_return = false;

    while (pos + 6 < source.len) : (pos += 1) {
        if (std.mem.eql(u8, source[pos..][0..6], "return")) {
            var rp = pos + 6;
            while (rp < source.len and (source[rp] == ' ' or source[rp] == '\n')) rp += 1;
            if (rp < source.len and source[rp] == '(') {
                pos = rp + 1;
                found_return = true;
                break;
            }
        }
    }

    if (!found_return) {
        // No return block — convert the whole file as HTML-like
        convertHtml(alloc, source, out);
        return;
    }

    // Convert the JSX inside the return block
    var depth: u32 = 1;
    const jsx_start = pos;
    while (pos < source.len and depth > 0) : (pos += 1) {
        if (source[pos] == '(') depth += 1;
        if (source[pos] == ')') {
            depth -= 1;
            if (depth == 0) break;
        }
    }
    const jsx = source[jsx_start..pos];
    convertHtml(alloc, jsx, out);
}

// ── Tag mapping ─────────────────────────────────────────────────────

fn mapHtmlTag(tag: []const u8) []const u8 {
    // Container elements → Box
    if (std.mem.eql(u8, tag, "div")) return "Box";
    if (std.mem.eql(u8, tag, "section")) return "Box";
    if (std.mem.eql(u8, tag, "article")) return "Box";
    if (std.mem.eql(u8, tag, "nav")) return "Box";
    if (std.mem.eql(u8, tag, "main")) return "Box";
    if (std.mem.eql(u8, tag, "header")) return "Box";
    if (std.mem.eql(u8, tag, "footer")) return "Box";
    if (std.mem.eql(u8, tag, "form")) return "Box";
    if (std.mem.eql(u8, tag, "ul")) return "Box";
    if (std.mem.eql(u8, tag, "ol")) return "Box";
    if (std.mem.eql(u8, tag, "li")) return "Box";
    if (std.mem.eql(u8, tag, "table")) return "Box";
    if (std.mem.eql(u8, tag, "tr")) return "Box";
    if (std.mem.eql(u8, tag, "td")) return "Box";
    if (std.mem.eql(u8, tag, "th")) return "Box";
    // Text elements → Text
    if (std.mem.eql(u8, tag, "span")) return "Text";
    if (std.mem.eql(u8, tag, "p")) return "Text";
    if (std.mem.eql(u8, tag, "h1")) return "Text";
    if (std.mem.eql(u8, tag, "h2")) return "Text";
    if (std.mem.eql(u8, tag, "h3")) return "Text";
    if (std.mem.eql(u8, tag, "h4")) return "Text";
    if (std.mem.eql(u8, tag, "h5")) return "Text";
    if (std.mem.eql(u8, tag, "h6")) return "Text";
    if (std.mem.eql(u8, tag, "label")) return "Text";
    if (std.mem.eql(u8, tag, "strong")) return "Text";
    if (std.mem.eql(u8, tag, "em")) return "Text";
    // Interactive → Pressable
    if (std.mem.eql(u8, tag, "button")) return "Pressable";
    if (std.mem.eql(u8, tag, "a")) return "Pressable";
    // Media → Image
    if (std.mem.eql(u8, tag, "img")) return "Image";
    // Input → TextInput
    if (std.mem.eql(u8, tag, "input")) return "TextInput";
    if (std.mem.eql(u8, tag, "textarea")) return "TextInput";
    // If it starts with uppercase, it's a React component — pass through
    if (tag.len > 0 and tag[0] >= 'A' and tag[0] <= 'Z') return tag;
    // Fragment
    if (tag.len == 0) return "Box";
    return "Box";
}

fn isTextTag(tag: []const u8) bool {
    return std.mem.eql(u8, tag, "span") or std.mem.eql(u8, tag, "p") or
        std.mem.eql(u8, tag, "h1") or std.mem.eql(u8, tag, "h2") or
        std.mem.eql(u8, tag, "h3") or std.mem.eql(u8, tag, "h4") or
        std.mem.eql(u8, tag, "h5") or std.mem.eql(u8, tag, "h6") or
        std.mem.eql(u8, tag, "label") or std.mem.eql(u8, tag, "strong") or
        std.mem.eql(u8, tag, "em") or std.mem.eql(u8, tag, "title");
}

// ── Inline CSS → style props ────────────────────────────────────────

fn convertInlineStyle(alloc: std.mem.Allocator, css: []const u8) []const u8 {
    var result = std.ArrayListUnmanaged(u8){};
    var iter = std.mem.splitScalar(u8, css, ';');
    var first = true;

    while (iter.next()) |decl| {
        const trimmed = std.mem.trim(u8, decl, " \n\r\t");
        if (trimmed.len == 0) continue;

        const colon_pos = std.mem.indexOfScalar(u8, trimmed, ':') orelse continue;
        const prop = std.mem.trim(u8, trimmed[0..colon_pos], " ");
        const val = std.mem.trim(u8, trimmed[colon_pos + 1 ..], " ");

        const tsz_prop = mapCssProp(prop);
        if (tsz_prop.len == 0) continue;

        if (!first) result.appendSlice(alloc, ", ") catch continue;
        first = false;

        result.appendSlice(alloc, tsz_prop) catch continue;
        result.appendSlice(alloc, ": ") catch continue;

        // Check if value is a number (with optional px)
        const clean_val = if (std.mem.endsWith(u8, val, "px")) val[0 .. val.len - 2] else val;
        if (clean_val.len > 0 and (clean_val[0] >= '0' and clean_val[0] <= '9')) {
            result.appendSlice(alloc, clean_val) catch continue;
        } else if (std.mem.startsWith(u8, val, "#") or std.mem.startsWith(u8, val, "rgb")) {
            result.appendSlice(alloc, "\"") catch continue;
            result.appendSlice(alloc, val) catch continue;
            result.appendSlice(alloc, "\"") catch continue;
        } else {
            // String value
            result.appendSlice(alloc, "\"") catch continue;
            result.appendSlice(alloc, val) catch continue;
            result.appendSlice(alloc, "\"") catch continue;
        }
    }

    return result.items;
}

fn mapCssProp(prop: []const u8) []const u8 {
    if (std.mem.eql(u8, prop, "display")) return ""; // handled by element type
    if (std.mem.eql(u8, prop, "flex-direction")) return "flexDirection";
    if (std.mem.eql(u8, prop, "flex-grow")) return "flexGrow";
    if (std.mem.eql(u8, prop, "flex-wrap")) return "flexWrap";
    if (std.mem.eql(u8, prop, "flex-basis")) return "flexBasis";
    if (std.mem.eql(u8, prop, "align-items")) return "alignItems";
    if (std.mem.eql(u8, prop, "justify-content")) return "justifyContent";
    if (std.mem.eql(u8, prop, "gap")) return "gap";
    if (std.mem.eql(u8, prop, "padding")) return "padding";
    if (std.mem.eql(u8, prop, "padding-top")) return "paddingTop";
    if (std.mem.eql(u8, prop, "padding-right")) return "paddingRight";
    if (std.mem.eql(u8, prop, "padding-bottom")) return "paddingBottom";
    if (std.mem.eql(u8, prop, "padding-left")) return "paddingLeft";
    if (std.mem.eql(u8, prop, "margin")) return "margin";
    if (std.mem.eql(u8, prop, "margin-top")) return "marginTop";
    if (std.mem.eql(u8, prop, "margin-right")) return "marginRight";
    if (std.mem.eql(u8, prop, "margin-bottom")) return "marginBottom";
    if (std.mem.eql(u8, prop, "margin-left")) return "marginLeft";
    if (std.mem.eql(u8, prop, "width")) return "width";
    if (std.mem.eql(u8, prop, "height")) return "height";
    if (std.mem.eql(u8, prop, "min-width")) return "minWidth";
    if (std.mem.eql(u8, prop, "min-height")) return "minHeight";
    if (std.mem.eql(u8, prop, "max-width")) return "maxWidth";
    if (std.mem.eql(u8, prop, "max-height")) return "maxHeight";
    if (std.mem.eql(u8, prop, "background-color")) return "backgroundColor";
    if (std.mem.eql(u8, prop, "background")) return "backgroundColor";
    if (std.mem.eql(u8, prop, "color")) return "color";
    if (std.mem.eql(u8, prop, "font-size")) return "fontSize";
    if (std.mem.eql(u8, prop, "border-radius")) return "borderRadius";
    if (std.mem.eql(u8, prop, "border-width")) return "borderWidth";
    if (std.mem.eql(u8, prop, "border-color")) return "borderColor";
    if (std.mem.eql(u8, prop, "overflow")) return "overflow";
    if (std.mem.eql(u8, prop, "opacity")) return "opacity";
    return "";
}

fn writeIndent(alloc: std.mem.Allocator, out: *std.ArrayListUnmanaged(u8), n: usize) void {
    for (0..n) |_| {
        out.append(alloc, ' ') catch return;
    }
}
