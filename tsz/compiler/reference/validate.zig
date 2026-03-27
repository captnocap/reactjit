//! Validation pass — catches errors before Zig emission.
//!
//! Runs after collection phases (state, components, classifiers, locals, etc.)
//! but before JSX parsing and emission. Scans the App function body for:
//!   - Unknown JSX tag names (not a primitive, component, classifier, or special)
//!   - Unknown identifiers in dynamic expressions ({ident} in JSX)
//!   - Component prop mismatches (passing props not declared by the component)

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const TokenKind = codegen.TokenKind;
const html_tags = @import("rules/html_tags.zig");
const surfaces = @import("rules/surfaces.zig");

const special_tags = [_][]const u8{
    "Route", "Routes", "C",
};

fn isPrimitive(name: []const u8) bool {
    // Check against the surface manifest (primitives + systems)
    if (surfaces.isTag(name)) return true;
    // Also accept HTML tags — they resolve to primitives at parse time
    return html_tags.isHtmlTag(name);
}

fn isSpecialTag(name: []const u8) bool {
    for (special_tags) |s| {
        if (std.mem.eql(u8, s, name)) return true;
    }
    return false;
}

/// Check if an identifier is resolvable: state getter, setter, local var, let var,
/// prop, FFI func, util func, or well-known JS keyword.
fn isKnownIdent(self: *Generator, name: []const u8) bool {
    // State getters and setters
    if (self.isState(name) != null) return true;
    if (self.isSetter(name) != null) return true;
    if (self.isObjectStateVar(name) != null) return true;

    // Local const vars
    if (self.isLocalVar(name) != null) return true;

    // Mutable let vars
    if (self.isLetVar(name) != null) return true;

    // Props (in component inlining context)
    if (self.findProp(name) != null) return true;

    // FFI functions
    if (self.isFFIFunc(name)) return true;

    // Computed arrays (.filter() / .split() results)
    if (self.isComputedArray(name) != null) return true;

    // Utility functions
    if (self.isUtilFunc(name) != null) return true;

    // Components (can appear as JSX tags, but also as identifiers in some contexts)
    if (self.findComponent(name) != null) return true;

    // JS/TS keywords and built-ins that appear in expressions
    const keywords = [_][]const u8{
        "true",       "false",      "null",     "undefined",
        "console",    "Math",       "Date",     "JSON",
        "parseInt",   "parseFloat", "String",   "Number",
        "Boolean",    "Array",      "Object",   "Map",
        "Set",        "Promise",    "Error",    "typeof",
        "instanceof", "new",        "this",     "window",
        "document",   "navigator",  "children", "props",
        // TSZ-specific
        "from",       "import",     "export",   "default",
        "function",   "const",      "let",      "var",
        "if",         "else",       "return",   "switch",
        "case",       "break",      "for",      "while",
        "class",      "interface",  "type",     "enum",
        "declare",    "void",       "useState", "useFFI",
        "useEffect",  "App",        "script",
    };
    for (keywords) |kw| {
        if (std.mem.eql(u8, kw, name)) return true;
    }

    return false;
}

/// Validate JSX tags in the App function body.
/// Reports unknown tag names that aren't primitives, components, classifiers, or specials.
fn validateTags(self: *Generator, app_start: u32) void {
    var pos = app_start;
    while (pos < self.lex.count) {
        const tok = self.lex.get(pos);
        if (tok.kind == .eof) break;

        // Look for < followed by an identifier (JSX open tag)
        if (tok.kind == .lt and pos + 1 < self.lex.count) {
            const next = self.lex.get(pos + 1);
            if (next.kind == .identifier) {
                const tag = next.text(self.source);

                // Skip closing tags (</Tag>)
                if (pos > 0 and self.lex.get(pos).kind == .lt_slash) {
                    pos += 1;
                    continue;
                }

                if (!isPrimitive(tag) and !isSpecialTag(tag) and
                    self.findComponent(tag) == null and
                    self.findClassifier(tag) == null)
                {
                    // Check if first char is uppercase (JSX convention for components)
                    if (tag.len > 0 and tag[0] >= 'A' and tag[0] <= 'Z') {
                        const msg = std.fmt.allocPrint(self.alloc, "Unknown component <{s}> — not defined as a component, classifier, or primitive", .{tag}) catch "Unknown component";
                        self.setErrorAt(next.start, msg);
                    }
                }
            }
        }
        pos += 1;
    }
}

/// Validate component prop usage.
/// When a component is invoked with props, check each prop name is declared by the component.
fn validateComponentProps(self: *Generator, app_start: u32) void {
    var pos = app_start;
    while (pos < self.lex.count) {
        const tok = self.lex.get(pos);
        if (tok.kind == .eof) break;

        // Look for < followed by a known component name
        if (tok.kind == .lt and pos + 1 < self.lex.count) {
            const next = self.lex.get(pos + 1);
            if (next.kind == .identifier) {
                const tag = next.text(self.source);
                if (self.findComponent(tag)) |comp| {
                    // Scan attributes until > or />
                    var attr_pos = pos + 2;
                    while (attr_pos < self.lex.count) {
                        const ak = self.lex.get(attr_pos).kind;
                        if (ak == .gt or ak == .slash_gt or ak == .eof) break;

                        // Skip brace-delimited expressions (spread syntax, etc.)
                        if (ak == .lbrace) {
                            var brace_depth: u32 = 1;
                            attr_pos += 1;
                            while (attr_pos < self.lex.count and brace_depth > 0) {
                                const bk = self.lex.get(attr_pos).kind;
                                if (bk == .lbrace) brace_depth += 1
                                else if (bk == .rbrace) brace_depth -= 1
                                else if (bk == .eof) break;
                                attr_pos += 1;
                            }
                            continue;
                        }
                        if (ak == .identifier) {
                            const attr_name = self.lex.get(attr_pos).text(self.source);
                            // Check if followed by = (it's a prop assignment)
                            if (attr_pos + 1 < self.lex.count and self.lex.get(attr_pos + 1).kind == .equals) {
                                // Verify this prop is declared by the component
                                var found = false;
                                for (comp.prop_names[0..comp.prop_count]) |pn| {
                                    if (std.mem.eql(u8, pn, attr_name)) {
                                        found = true;
                                        break;
                                    }
                                }
                                // Also allow "children" and known HTML-like attrs
                                if (!found and !std.mem.eql(u8, attr_name, "children") and
                                    !std.mem.eql(u8, attr_name, "key"))
                                {
                                    const msg = std.fmt.allocPrint(self.alloc, "Unknown prop '{s}' on <{s}> — component declares: {s}", .{ attr_name, tag, formatPropList(self, comp) }) catch "Unknown prop on component";
                                    self.setErrorAt(self.lex.get(attr_pos).start, msg);
                                }
                                // Skip over the prop value expression to avoid entering nested JSX
                                attr_pos += 2; // skip past identifier and =
                                if (attr_pos < self.lex.count and self.lex.get(attr_pos).kind == .lbrace) {
                                    var brace_depth: u32 = 1;
                                    attr_pos += 1;
                                    while (attr_pos < self.lex.count and brace_depth > 0) {
                                        const bk = self.lex.get(attr_pos).kind;
                                        if (bk == .lbrace) brace_depth += 1
                                        else if (bk == .rbrace) brace_depth -= 1
                                        else if (bk == .eof) break;
                                        attr_pos += 1;
                                    }
                                    continue; // attr_pos is now past the closing }
                                }
                                continue;
                            }
                        }
                        attr_pos += 1;
                    }
                }
            }
        }
        pos += 1;
    }
}

fn formatPropList(self: *Generator, comp: *const codegen.ComponentInfo) []const u8 {
    if (comp.prop_count == 0) return "(none)";
    var buf: std.ArrayListUnmanaged(u8) = .{};
    for (comp.prop_names[0..comp.prop_count], 0..) |pn, i| {
        if (i > 0) buf.appendSlice(self.alloc, ", ") catch {};
        buf.appendSlice(self.alloc, pn) catch {};
    }
    return buf.toOwnedSlice(self.alloc) catch "(none)";
}

/// Validate dynamic expression identifiers in JSX.
/// Scans for { ident } patterns inside JSX and checks ident is resolvable.
fn validateExpressionIdents(self: *Generator, app_start: u32) void {
    var pos = app_start;
    var jsx_depth: u32 = 0;

    while (pos < self.lex.count) {
        const tok = self.lex.get(pos);
        if (tok.kind == .eof) break;

        // Track JSX nesting depth (rough heuristic)
        if (tok.kind == .lt and pos + 1 < self.lex.count and
            self.lex.get(pos + 1).kind == .identifier)
        {
            jsx_depth += 1;
        }
        if (tok.kind == .lt_slash) {
            if (jsx_depth > 0) jsx_depth -= 1;
        }

        // Inside JSX, look for { ident } or { ident. or { ident( patterns
        // But skip style={{ ... }} and other attribute objects — look for attr={
        if (jsx_depth > 0 and tok.kind == .lbrace and pos + 1 < self.lex.count) {
            // Skip double-brace patterns: attr={{ ... }} (style objects, etc.)
            if (self.lex.get(pos + 1).kind == .lbrace) {
                // Skip to matching }}
                var depth: u32 = 0;
                pos += 1;
                while (pos < self.lex.count) {
                    const k = self.lex.get(pos).kind;
                    if (k == .lbrace) depth += 1;
                    if (k == .rbrace) {
                        if (depth <= 1) {
                            pos += 1;
                            break;
                        }
                        depth -= 1;
                    }
                    if (k == .eof) break;
                    pos += 1;
                }
                continue;
            }

            // Skip attribute-value braces: attrName={...} where prev token is =
            if (pos >= 2) {
                const prev = self.lex.get(pos - 1);
                if (prev.kind == .equals) {
                    // This is an attribute value — skip the whole {expr}
                    var depth: u32 = 1;
                    pos += 1;
                    while (pos < self.lex.count and depth > 0) {
                        const k = self.lex.get(pos).kind;
                        if (k == .lbrace) depth += 1;
                        if (k == .rbrace) depth -= 1;
                        if (k == .eof) break;
                        pos += 1;
                    }
                    continue;
                }
            }

            const next = self.lex.get(pos + 1);
            if (next.kind == .identifier) {
                const ident = next.text(self.source);

                // Skip if followed by && (conditional rendering — handled separately)
                if (pos + 2 < self.lex.count and self.lex.get(pos + 2).kind == .amp_amp) {
                    pos += 1;
                    continue;
                }

                // Skip if followed by ? (ternary conditional)
                if (pos + 2 < self.lex.count and self.lex.get(pos + 2).kind == .question) {
                    pos += 1;
                    continue;
                }

                // Skip if followed by comparison/arithmetic operator (conditional expression, e.g. {i == 0 && ...})
                if (pos + 2 < self.lex.count) {
                    const nk = self.lex.get(pos + 2).kind;
                    if (nk == .eq_eq or nk == .not_eq or nk == .gt or nk == .lt or
                        nk == .gt_eq or nk == .lt_eq or nk == .percent or
                        nk == .plus or nk == .minus)
                    {
                        pos += 1;
                        continue;
                    }
                }

                // Skip .map() / .filter() / .split() patterns
                if (std.mem.endsWith(u8, ident, "map") or
                    std.mem.endsWith(u8, ident, "filter") or
                    std.mem.endsWith(u8, ident, "split"))
                {
                    pos += 1;
                    continue;
                }

                // Skip ident followed by . (dot access — e.g. items.map, filtered.map)
                if (pos + 2 < self.lex.count and self.lex.get(pos + 2).kind == .dot) {
                    pos += 1;
                    continue;
                }

                if (!isKnownIdent(self, ident)) {
                    const msg = std.fmt.allocPrint(self.alloc, "Unknown identifier '{s}' in expression — not a state variable, prop, local, or function", .{ident}) catch "Unknown identifier in expression";
                    self.setErrorAt(next.start, msg);
                }
            }
        }
        pos += 1;
    }
}

/// Run all validation checks. Call after collection phases, before JSX parse + emission.
/// Returns without error even if issues are found — errors are reported via setErrorAt
/// and will cause the pipeline to abort at the compile_error check.
pub fn validate(self: *Generator, app_start: u32) void {
    validateTags(self, app_start);
    validateComponentProps(self, app_start);
    validateExpressionIdents(self, app_start);
}
