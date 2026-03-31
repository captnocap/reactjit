//! Collection phase — scans tokens and populates Generator fields.
//!
//! All functions here are pure readers: they scan the token stream and
//! fill in Generator arrays/counts. No Zig code is emitted.
//!
//! Pipeline order (called from codegen.zig generate()):
//!   Phase 1:   collectFFIPragmas        — // @ffi <header.h> -llib → ffi_headers, ffi_libs
//!   Phase 2:   collectDeclaredFunctions — declare function foo(): type → ffi_funcs, return types, arg counts
//!   Phase 3:   collectClassifiers       — classifier({...}) → classifier_names/primitives/styles/text_props
//!   Phase 4:   collectComponents        — function MyComp({props}) → components[] with body_pos for later inlining
//!   Phase 4.5: collectUtilFunctions     — function lowercase() → util_funcs[] (non-component, non-App helpers)
//!   Phase 5:   extractComputeBlock      — <script>JS</script> → compute_js
//!   Phase 6:   collectStateHooksTopLevel + collectStateHooks — useState/useFFI/useTransition/useSpring
//!   Phase 6.5: collectLetVars           — let x = expr → let_vars[] (mutable runtime vars)
//!   Phase 7:   countComponentUsage      — count <MyComp> refs → usage_count (for multi-use optimization)
//!   Phase 7.5: collectAppConditionals   — {state == N && <JSX>} at root → app_conds[]
//!
//! Also: findAppFunction, findReturnStatement, rewriteSetterCalls (JS setter→__setState rewriting)

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const attrs = @import("attrs.zig");
const handlers = @import("handlers.zig");
const collect_hooks = @import("collect_hooks.zig");
const collect_rewrite = @import("collect_rewrite.zig");

// Re-export functions from collect_hooks (callers use collect.collectUtilFunctions etc.)
pub const collectUtilFunctions = collect_hooks.collectUtilFunctions;
pub const collectLetVars = collect_hooks.collectLetVars;
pub const collectEffectHooks = collect_hooks.collectEffectHooks;
pub const inferExprType = collect_hooks.inferExprType;

// ── FFI collection ──

/// Phase 1: Scan all tokens for FFI pragma comments.
/// Input:  // @ffi <time.h> -lrt
/// Output: ffi_headers += "time.h", ffi_libs += "rt"
/// These get emitted as @cImport/@cInclude in the generated Zig.
pub fn collectFFIPragmas(self: *Generator) void {
    var i: u32 = 0;
    while (i < self.lex.count) : (i += 1) {
        const tok = self.lex.get(i);
        if (tok.kind == .ffi_pragma) {
            const text = tok.text(self.source);
            if (std.mem.indexOf(u8, text, "<")) |lt_pos| {
                if (std.mem.indexOf(u8, text, ">")) |gt_pos| {
                    if (gt_pos > lt_pos) {
                        const header = text[lt_pos + 1 .. gt_pos];
                        self.ffi_headers.append(self.alloc, header) catch {};
                    }
                    const after = text[gt_pos + 1 ..];
                    if (std.mem.indexOf(u8, after, "-l")) |l_pos| {
                        const lib = std.mem.trim(u8, after[l_pos + 2 ..], &[_]u8{ ' ', '\t', '\n', '\r' });
                        if (lib.len > 0) self.ffi_libs.append(self.alloc, lib) catch {};
                    }
                }
            }
        }
    }
}

/// Phase 2: Scan for TypeScript-style FFI function declarations.
/// Input:  declare function getTime(a: number): number
/// Output: ffi_funcs += "getTime", ffi_return_types += .int, ffi_arg_counts += 1
/// These tell the compiler what C functions are available and how to wrap them.
/// The return type is parsed from the `: type` annotation after the param list.
/// Arg count is determined by counting commas inside the parentheses.
pub fn collectDeclaredFunctions(self: *Generator) void {
    while (self.pos < self.lex.count and self.curKind() != .eof) {
        if (self.isIdent("declare")) {
            self.advance_token();
            if (self.isIdent("function")) {
                self.advance_token();
                if (self.curKind() == .identifier) {
                    self.ffi_funcs.append(self.alloc, self.curText()) catch {};
                    var ret_type: codegen.StateType = .int;
                    var arg_count: u32 = 0;
                    const saved = self.pos;
                    self.advance_token();
                    if (self.curKind() == .lparen) {
                        var depth: u32 = 1;
                        self.advance_token();
                        if (self.curKind() != .rparen) arg_count = 1;
                        while (depth > 0 and self.curKind() != .eof) {
                            if (self.curKind() == .lparen) depth += 1;
                            if (self.curKind() == .rparen) depth -= 1;
                            if (self.curKind() == .comma and depth == 1) arg_count += 1;
                            if (depth > 0) self.advance_token();
                        }
                        if (self.curKind() == .rparen) self.advance_token();
                    }
                    if (self.curKind() == .colon) {
                        self.advance_token();
                        if (self.curKind() == .identifier) {
                            const type_name = self.curText();
                            if (std.mem.eql(u8, type_name, "string")) ret_type = .string else if (std.mem.eql(u8, type_name, "boolean")) ret_type = .boolean else if (std.mem.eql(u8, type_name, "number")) ret_type = .int;
                        }
                    }
                    self.pos = saved;
                    self.ffi_return_types.append(self.alloc, ret_type) catch {};
                    self.ffi_arg_counts.append(self.alloc, arg_count) catch {};
                }
            }
        }
        self.advance_token();
    }
}

// ── Classifier collection ──

/// Phase 3: Collect classifier() style abstractions from _cls.tsz files.
///
/// Classifiers are named style bundles that map to a primitive + style + text props.
/// Input:
///   classifier({
///     Title: { type: 'Text', style: { fontSize: 24 }, color: '#fff', grow: true },
///     Card:  { style: { padding: 16, borderRadius: 8 } }
///   })
///
/// Output: classifier_names/primitives/styles/text_props arrays populated.
/// Usage in JSX: <C.Title>Hello</C.Title> expands to <Text style={{fontSize:24}} color="#fff">
pub fn collectClassifiers(self: *Generator) void {
    while (self.pos < self.lex.count and self.curKind() != .eof) {
        if (self.isIdent("classifier")) {
            self.advance_token();
            if (self.curKind() == .lparen) self.advance_token();
            if (self.curKind() == .lbrace) self.advance_token();

            while (self.curKind() != .rbrace and self.curKind() != .eof) {
                if (self.curKind() == .identifier) {
                    const name = self.curText();
                    self.advance_token();
                    if (self.curKind() == .colon) self.advance_token();
                    if (self.curKind() == .lbrace) {
                        self.advance_token();

                        var prim_type: []const u8 = "Box";
                        var style_str: []const u8 = "";
                        var text_props: []const u8 = "";

                        while (self.curKind() != .rbrace and self.curKind() != .eof) {
                            if (self.curKind() == .identifier) {
                                const field = self.curText();
                                self.advance_token();
                                if (self.curKind() == .colon) self.advance_token();

                                if (std.mem.eql(u8, field, "type")) {
                                    prim_type = attrs.parseStringAttrInline(self) catch "Box";
                                } else if (std.mem.eql(u8, field, "style")) {
                                    style_str = attrs.parseStyleAttr(self) catch "";
                                } else if (std.mem.eql(u8, field, "size") or std.mem.eql(u8, field, "fontSize")) {
                                    const sz = self.curText();
                                    self.advance_token();
                                    text_props = std.fmt.allocPrint(self.alloc, ".font_size = {s}", .{sz}) catch "";
                                } else if (std.mem.eql(u8, field, "bold")) {
                                    if (self.curKind() == .identifier) self.advance_token();
                                } else if (std.mem.eql(u8, field, "color")) {
                                    const col = attrs.parseStringAttrInline(self) catch "";
                                    if (col.len > 0) {
                                        const zig_col = attrs.parseColorValue(self, col) catch "Color.rgb(255,255,255)";
                                        text_props = std.fmt.allocPrint(self.alloc, "{s}, .text_color = {s}", .{
                                            if (text_props.len > 0) text_props else "",
                                            zig_col,
                                        }) catch "";
                                    }
                                } else if (std.mem.eql(u8, field, "grow")) {
                                    if (self.curKind() == .identifier) self.advance_token();
                                    if (style_str.len > 0) {
                                        style_str = std.fmt.allocPrint(self.alloc, "{s}, .flex_grow = 1", .{style_str}) catch style_str;
                                    } else {
                                        style_str = ".flex_grow = 1";
                                    }
                                } else if (std.mem.eql(u8, field, "variants")) {
                                    // variants: { name: { style: {...} }, name2: { style: {...} } }
                                    if (self.curKind() == .lbrace) self.advance_token();
                                    while (self.curKind() != .rbrace and self.curKind() != .eof) {
                                        if (self.curKind() == .identifier) {
                                            const vname = self.curText();
                                            const vidx = self.findOrAddVariant(vname);
                                            self.advance_token();
                                            if (self.curKind() == .colon) self.advance_token();
                                            if (self.curKind() == .lbrace) {
                                                self.advance_token();
                                                // parse inner fields: style, fontSize, color
                                                var v_style: []const u8 = "";
                                                var v_text_props: []const u8 = "";
                                                while (self.curKind() != .rbrace and self.curKind() != .eof) {
                                                    if (self.curKind() == .identifier) {
                                                        const vf = self.curText();
                                                        self.advance_token();
                                                        if (self.curKind() == .colon) self.advance_token();
                                                        if (std.mem.eql(u8, vf, "style")) {
                                                            v_style = attrs.parseStyleAttr(self) catch "";
                                                        } else if (std.mem.eql(u8, vf, "fontSize") or std.mem.eql(u8, vf, "size")) {
                                                            const sz = self.curText();
                                                            self.advance_token();
                                                            v_text_props = std.fmt.allocPrint(self.alloc, ".font_size = {s}", .{sz}) catch "";
                                                        } else if (std.mem.eql(u8, vf, "color")) {
                                                            const vcol = attrs.parseStringAttrInline(self) catch "";
                                                            if (vcol.len > 0) {
                                                                const vczig = attrs.parseColorValue(self, vcol) catch "Color.rgb(255,255,255)";
                                                                v_text_props = std.fmt.allocPrint(self.alloc, "{s}, .text_color = {s}", .{
                                                                    if (v_text_props.len > 0) v_text_props else "",
                                                                    vczig,
                                                                }) catch "";
                                                            }
                                                        } else {
                                                            self.advance_token();
                                                        }
                                                    } else {
                                                        self.advance_token();
                                                    }
                                                    if (self.curKind() == .comma) self.advance_token();
                                                }
                                                if (self.curKind() == .rbrace) self.advance_token();
                                                // Store variant style at [classifier_count][vidx]
                                                if (self.classifier_count < codegen.MAX_CLASSIFIERS and vidx > 0 and vidx < codegen.MAX_VARIANTS) {
                                                    self.classifier_variant_styles[self.classifier_count][vidx] = v_style;
                                                    self.classifier_variant_text_props[self.classifier_count][vidx] = v_text_props;
                                                    self.classifier_has_variants[self.classifier_count] = true;
                                                }
                                            }
                                        } else {
                                            self.advance_token();
                                        }
                                        if (self.curKind() == .comma) self.advance_token();
                                    }
                                    if (self.curKind() == .rbrace) self.advance_token();
                                } else if (std.mem.eql(u8, field, "bp")) {
                                    // bp: { sm: { style: {}, variants: {} }, md: {}, ... }
                                    // Allocate a bp slot for this classifier
                                    const cls_idx = self.classifier_count;
                                    var bp_slot: ?u8 = self.classifier_bp_idx[cls_idx];
                                    if (bp_slot == null and self.bp_count < codegen.MAX_BP_CLASSIFIERS) {
                                        bp_slot = self.bp_count;
                                        self.classifier_bp_idx[cls_idx] = bp_slot;
                                        self.bp_count += 1;
                                    }
                                    if (self.curKind() == .lbrace) self.advance_token();
                                    while (self.curKind() != .rbrace and self.curKind() != .eof) {
                                        if (self.curKind() == .identifier) {
                                            const tier_name = self.curText();
                                            const tier_idx: ?u8 = if (std.mem.eql(u8, tier_name, "sm")) 0
                                                else if (std.mem.eql(u8, tier_name, "md")) 1
                                                else if (std.mem.eql(u8, tier_name, "lg")) 2
                                                else if (std.mem.eql(u8, tier_name, "xl")) 3
                                                else null;
                                            self.advance_token();
                                            if (self.curKind() == .colon) self.advance_token();
                                            if (tier_idx) |ti| {
                                                if (self.curKind() == .lbrace) {
                                                    self.advance_token();
                                                    while (self.curKind() != .rbrace and self.curKind() != .eof) {
                                                        if (self.curKind() == .identifier) {
                                                            const bf = self.curText();
                                                            self.advance_token();
                                                            if (self.curKind() == .colon) self.advance_token();
                                                            if (std.mem.eql(u8, bf, "style")) {
                                                                const bp_style = attrs.parseStyleAttr(self) catch "";
                                                                if (bp_slot) |bs| {
                                                                    self.bp_styles[bs][ti] = bp_style;
                                                                    self.has_breakpoints = true;
                                                                }
                                                            } else if (std.mem.eql(u8, bf, "variants")) {
                                                                if (self.curKind() == .lbrace) self.advance_token();
                                                                while (self.curKind() != .rbrace and self.curKind() != .eof) {
                                                                    if (self.curKind() == .identifier) {
                                                                        const bvname = self.curText();
                                                                        const bvidx = self.findOrAddVariant(bvname);
                                                                        self.advance_token();
                                                                        if (self.curKind() == .colon) self.advance_token();
                                                                        if (self.curKind() == .lbrace) {
                                                                            self.advance_token();
                                                                            while (self.curKind() != .rbrace and self.curKind() != .eof) {
                                                                                if (self.curKind() == .identifier) {
                                                                                    const bvf = self.curText();
                                                                                    self.advance_token();
                                                                                    if (self.curKind() == .colon) self.advance_token();
                                                                                    if (std.mem.eql(u8, bvf, "style")) {
                                                                                        const bv_style = attrs.parseStyleAttr(self) catch "";
                                                                                        if (bp_slot) |bs| {
                                                                                            if (bvidx > 0 and bvidx < codegen.MAX_VARIANTS) {
                                                                                                self.bp_variant_styles[bs][ti][bvidx] = bv_style;
                                                                                                self.bp_has_variants[bs][ti] = true;
                                                                                            }
                                                                                        }
                                                                                    } else {
                                                                                        self.advance_token();
                                                                                    }
                                                                                } else {
                                                                                    self.advance_token();
                                                                                }
                                                                                if (self.curKind() == .comma) self.advance_token();
                                                                            }
                                                                            if (self.curKind() == .rbrace) self.advance_token();
                                                                        }
                                                                    } else {
                                                                        self.advance_token();
                                                                    }
                                                                    if (self.curKind() == .comma) self.advance_token();
                                                                }
                                                                if (self.curKind() == .rbrace) self.advance_token();
                                                            } else {
                                                                self.advance_token();
                                                            }
                                                        } else {
                                                            self.advance_token();
                                                        }
                                                        if (self.curKind() == .comma) self.advance_token();
                                                    }
                                                    if (self.curKind() == .rbrace) self.advance_token();
                                                }
                                            } else {
                                                self.advance_token();
                                            }
                                        } else {
                                            self.advance_token();
                                        }
                                        if (self.curKind() == .comma) self.advance_token();
                                    }
                                    if (self.curKind() == .rbrace) self.advance_token();
                                } else {
                                    self.advance_token();
                                }
                            } else {
                                self.advance_token();
                            }
                            if (self.curKind() == .comma) self.advance_token();
                        }
                        if (self.curKind() == .rbrace) self.advance_token();

                        if (self.classifier_count < codegen.MAX_CLASSIFIERS) {
                            const idx = self.classifier_count;
                            self.classifier_names[idx] = name;
                            self.classifier_primitives[idx] = prim_type;
                            self.classifier_styles[idx] = style_str;
                            self.classifier_text_props[idx] = text_props;
                            // Copy base style into variant slot 0 if this classifier has variants
                            if (self.classifier_has_variants[idx]) {
                                self.classifier_variant_styles[idx][0] = style_str;
                                self.classifier_variant_text_props[idx][0] = text_props;
                                self.has_theme = true; // variants need Theme import for activeVariant()
                            }
                            // Fill breakpoint tier fallbacks: unspecified tiers use base style
                            if (self.classifier_bp_idx[idx]) |bs| {
                                for (0..4) |ti| {
                                    if (self.bp_styles[bs][ti].len == 0) {
                                        self.bp_styles[bs][ti] = style_str;
                                    }
                                    // Copy base variant styles into tiers that don't define their own
                                    if (!self.bp_has_variants[bs][ti] and self.classifier_has_variants[idx]) {
                                        for (0..codegen.MAX_VARIANTS) |vi| {
                                            if (self.classifier_variant_styles[idx][vi].len > 0) {
                                                self.bp_variant_styles[bs][ti][vi] = self.classifier_variant_styles[idx][vi];
                                            }
                                        }
                                        self.bp_has_variants[bs][ti] = true;
                                    }
                                    // Slot 0 of each tier's variants is the tier's base style
                                    if (self.bp_has_variants[bs][ti]) {
                                        self.bp_variant_styles[bs][ti][0] = self.bp_styles[bs][ti];
                                    }
                                }
                                self.has_theme = true;
                            }
                            self.classifier_count += 1;
                        }
                    }
                } else {
                    self.advance_token();
                }
                if (self.curKind() == .comma) self.advance_token();
            }
            if (self.curKind() == .rbrace) self.advance_token();
            if (self.curKind() == .rparen) self.advance_token();
            continue;
        }
        self.advance_token();
    }
}

// ── Component collection ──

/// Phase 4: Scan for component function definitions (uppercase, non-App).
///
/// Input: function MyButton({ label, color }) { return (<Box>...</Box>) }
/// Output: components[] entry with name="MyButton", prop_names=["label","color"],
///         body_pos pointing to the <Box> token for later inlining by components.zig.
///
/// Also scans forward to check if the component body contains {children},
/// which determines whether caller children get spliced in during inlining.
pub fn collectComponents(self: *Generator) void {
    self.pos = 0;
    while (self.pos < self.lex.count and self.curKind() != .eof) {
        if (self.isIdent("function")) {
            self.advance_token();
            if (self.curKind() != .identifier) continue;
            const name = self.curText();
            if (std.mem.eql(u8, name, "App")) {
                self.advance_token();
                continue;
            }
            if (name.len == 0 or name[0] < 'A' or name[0] > 'Z') {
                self.advance_token();
                continue;
            }
            self.advance_token();

            var prop_names: [codegen.MAX_COMPONENT_PROPS][]const u8 = undefined;
            var prop_count: u32 = 0;
            if (self.curKind() == .lparen) {
                self.advance_token();
                if (self.curKind() == .lbrace) {
                    // Destructured props: function Comp({ a, b, c })
                    self.advance_token();
                    while (self.curKind() != .rbrace and self.curKind() != .eof) {
                        if (self.curKind() == .identifier) {
                            if (prop_count < codegen.MAX_COMPONENT_PROPS) {
                                prop_names[prop_count] = self.curText();
                                prop_count += 1;
                            }
                        }
                        self.advance_token();
                        if (self.curKind() == .comma) self.advance_token();
                    }
                    if (self.curKind() == .rbrace) self.advance_token();
                } else if (self.curKind() == .identifier) {
                    // Positional props: function Comp(a, b, c)
                    while (self.curKind() != .rparen and self.curKind() != .eof) {
                        if (self.curKind() == .identifier) {
                            if (prop_count < codegen.MAX_COMPONENT_PROPS) {
                                prop_names[prop_count] = self.curText();
                                prop_count += 1;
                            }
                        }
                        self.advance_token();
                        if (self.curKind() == .comma) self.advance_token();
                    }
                }
                var paren_depth: u32 = 1;
                while (self.pos < self.lex.count and paren_depth > 0) {
                    if (self.curKind() == .lparen) paren_depth += 1;
                    if (self.curKind() == .rparen) {
                        paren_depth -= 1;
                        if (paren_depth == 0) break;
                    }
                    self.advance_token();
                }
                if (self.curKind() == .rparen) self.advance_token();
            }

            if (self.curKind() == .lbrace) {
                self.advance_token();
                var brace_depth: u32 = 1;
                while (self.pos < self.lex.count and brace_depth > 0) {
                    if (self.isIdent("return") and brace_depth == 1) {
                        self.advance_token();
                        if (self.curKind() == .lparen) self.advance_token();
                        if (self.curKind() == .lt or self.curKind() == .identifier) {
                            if (self.component_count < codegen.MAX_COMPONENTS) {
                                const body_pos = self.pos;
                                var has_children = false;
                                if (self.curKind() == .lt) {
                                    const scan_save = self.pos;
                                    var scan_depth: u32 = 0;
                                    while (self.pos < self.lex.count) {
                                        if (self.curKind() == .lt) scan_depth += 1;
                                        if (self.isIdent("children")) {
                                            has_children = true;
                                            break;
                                        }
                                        if (self.curKind() == .rbrace and scan_depth == 0) break;
                                        self.advance_token();
                                    }
                                    self.pos = scan_save;
                                }

                                self.components[self.component_count] = .{
                                    .name = name,
                                    .prop_names = prop_names,
                                    .prop_count = prop_count,
                                    .body_pos = body_pos,
                                    .has_children = has_children,
                                    .usage_count = 0,
                                    .func_generated = false,
                                };
                                self.component_count += 1;
                            } else {
                                self.setError("Too many component definitions (limit: 64)");
                            }
                        }
                        break;
                    }
                    if (self.curKind() == .lbrace) brace_depth += 1;
                    if (self.curKind() == .rbrace) brace_depth -= 1;
                    self.advance_token();
                }
            }
            continue;
        }
        self.advance_token();
    }
}

/// Phase 7: Count how many times each component is referenced as <MyComp> in the App body.
/// Components with usage_count >= 2 are eligible for the init-function optimization
/// (compFuncInline in components.zig) which deduplicates the generated node tree.
pub fn countComponentUsage(self: *Generator, app_start: u32) void {
    const saved_pos = self.pos;
    defer self.pos = saved_pos;
    self.pos = app_start;
    while (self.pos < self.lex.count and self.curKind() != .eof) {
        if (self.curKind() == .lt) {
            self.advance_token();
            if (self.curKind() == .identifier) {
                const name = self.curText();
                if (name.len > 0 and name[0] >= 'A' and name[0] <= 'Z') {
                    for (0..self.component_count) |i| {
                        if (std.mem.eql(u8, self.components[i].name, name)) {
                            self.components[i].usage_count += 1;
                            break;
                        }
                    }
                }
            }
        }
        self.advance_token();
    }
}

// ── App + state collection ──

/// Phase 7.5: Scan the root JSX element's direct children for top-level state conditionals.
///
/// Looks for patterns like: {activeTab == 0 && <TabContent/>}
/// at the root level of the App's return JSX. These become AppConditional entries
/// that _updateConditionals() toggles via display:.flex/.none.
///
/// This is a pre-pass before JSX parsing — it uses a lightweight scan that
/// only handles simple `state == N &&` patterns (not arbitrary expressions).
pub fn collectAppConditionals(self: *Generator) void {
    if (self.curKind() != .lt) return;
    self.advance_token();
    while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
        self.advance_token();
    }
    if (self.curKind() == .slash_gt) return;
    self.advance_token();

    var child_idx: u32 = 0;
    while (self.curKind() != .lt_slash and self.curKind() != .eof) {
        if (self.curKind() == .lt) {
            var depth: u32 = 1;
            self.advance_token();
            while (depth > 0 and self.curKind() != .eof) {
                if (self.curKind() == .lt) depth += 1;
                if (self.curKind() == .lt_slash) {
                    depth -= 1;
                    if (depth == 0) {
                        self.advance_token();
                        while (self.curKind() != .gt and self.curKind() != .eof) self.advance_token();
                        if (self.curKind() == .gt) self.advance_token();
                        break;
                    }
                }
                if (self.curKind() == .slash_gt) {
                    depth -= 1;
                    self.advance_token();
                    if (depth == 0) break;
                    continue;
                }
                self.advance_token();
            }
            child_idx += 1;
        } else if (self.curKind() == .lbrace) {
            self.advance_token();
            if (self.curKind() == .identifier) {
                const ident = self.curText();
                if (self.isState(ident)) |slot_id| {
                    const scan_start = self.pos;
                    self.advance_token();
                    if (self.curKind() == .eq_eq or self.curKind() == .not_eq) {
                        const op: []const u8 = if (self.curKind() == .eq_eq) " == " else " != ";
                        self.advance_token();
                        if (self.curKind() == .number) {
                            const num = self.curText();
                            self.advance_token();
                            if (self.curKind() == .amp_amp) {
                                self.advance_token();
                                const rid = self.regularSlotId(slot_id);
                                const st = self.stateTypeById(slot_id);
                                const accessor = switch (st) {
                                    .string => std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}) catch "",
                                    .float => std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}) catch "",
                                    .boolean => std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{rid}) catch "",
                                    else => std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}) catch "",
                                };
                                const cond = std.fmt.allocPrint(self.alloc, "({s}{s}{s})", .{ accessor, op, num }) catch "";
                                if (self.app_cond_count < codegen.MAX_APP_CONDS) {
                                    self.app_conds[self.app_cond_count] = .{
                                        .cond_expr = cond,
                                        .child_idx = child_idx,
                                    };
                                    self.app_cond_count += 1;
                                }
                                var depth: u32 = 1;
                                while (depth > 0 and self.curKind() != .eof) {
                                    if (self.curKind() == .lbrace) depth += 1;
                                    if (self.curKind() == .rbrace) depth -= 1;
                                    if (depth > 0) self.advance_token();
                                }
                                if (self.curKind() == .rbrace) self.advance_token();
                                child_idx += 1;
                                continue;
                            }
                        }
                    }
                    self.pos = scan_start;
                }
            }
            var depth: u32 = 1;
            while (depth > 0 and self.curKind() != .eof) {
                if (self.curKind() == .lbrace) depth += 1;
                if (self.curKind() == .rbrace) depth -= 1;
                if (depth > 0) self.advance_token();
            }
            if (self.curKind() == .rbrace) self.advance_token();
        } else {
            self.advance_token();
        }
    }
}

/// Find the App function's token position. Scans all `function` keywords and
/// returns the position of `function App`. Falls back to the last function
/// if no explicit App is found (single-function files).
pub fn findAppFunction(self: *Generator) ?u32 {
    var last_func: ?u32 = null;
    var app_func: ?u32 = null;
    while (self.pos < self.lex.count and self.curKind() != .eof) {
        if (self.isIdent("function")) {
            const func_start = self.pos;
            self.advance_token();
            if (self.curKind() == .identifier) {
                const name = self.curText();
                if (std.mem.eql(u8, name, "App")) app_func = func_start;
                last_func = func_start;
            }
        }
        self.advance_token();
    }
    return app_func orelse last_func;
}

/// Phase 6a: Scan the entire source for useState/useFFI outside any function.
/// Top-level state hooks are rare but supported for module-level state.
pub fn collectStateHooksTopLevel(self: *Generator) void {
    self.pos = 0;
    scanForUseState(self, false);
}

/// Phase 6b: Scan the App function body for useState/useFFI hooks.
/// Skips to the opening brace of the function, then delegates to scanForUseState.
pub fn collectStateHooks(self: *Generator, func_start: u32) void {
    self.pos = func_start;
    while (self.pos < self.lex.count and self.curKind() != .lbrace) self.advance_token();
    if (self.curKind() == .lbrace) self.advance_token();
    scanForUseState(self, true);
}

fn parseStateInitial(self: *Generator) codegen.StateInitial {
    var initial: codegen.StateInitial = .{ .int = 0 };
    if (self.curKind() == .number) {
        const num_text = self.curText();
        if (std.mem.indexOf(u8, num_text, ".") != null) {
            initial = .{ .float = std.fmt.parseFloat(f64, num_text) catch 0.0 };
        } else {
            initial = .{ .int = std.fmt.parseInt(i64, num_text, 10) catch 0 };
        }
        self.advance_token();
    } else if (self.curKind() == .string) {
        const raw = self.curText();
        initial = .{ .string = raw[1 .. raw.len - 1] };
        self.advance_token();
    } else if (self.curKind() == .identifier) {
        const val = self.curText();
        if (std.mem.eql(u8, val, "true")) {
            initial = .{ .boolean = true };
            self.advance_token();
        } else if (std.mem.eql(u8, val, "false")) {
            initial = .{ .boolean = false };
            self.advance_token();
        }
    } else if (self.curKind() == .lbracket) {
        self.advance_token();
        var arr_vals: [codegen.MAX_ARRAY_INIT]i64 = undefined;
        var str_vals: [codegen.MAX_ARRAY_INIT][]const u8 = undefined;
        var arr_cnt: u32 = 0;
        var has_strings = false;
        while (self.curKind() != .rbracket and self.curKind() != .eof) {
            if (self.curKind() == .string) {
                has_strings = true;
                const raw = self.curText();
                if (arr_cnt < codegen.MAX_ARRAY_INIT) {
                    str_vals[arr_cnt] = raw[1 .. raw.len - 1]; // strip quotes
                    arr_cnt += 1;
                }
                self.advance_token();
            } else if (self.curKind() == .number) {
                if (arr_cnt < codegen.MAX_ARRAY_INIT) {
                    arr_vals[arr_cnt] = std.fmt.parseInt(i64, self.curText(), 10) catch 0;
                    arr_cnt += 1;
                }
                self.advance_token();
            } else if (self.curKind() == .minus) {
                self.advance_token();
                if (self.curKind() == .number) {
                    if (arr_cnt < codegen.MAX_ARRAY_INIT) {
                        arr_vals[arr_cnt] = -(std.fmt.parseInt(i64, self.curText(), 10) catch 0);
                        arr_cnt += 1;
                    }
                    self.advance_token();
                }
            } else {
                self.advance_token();
            }
            if (self.curKind() == .comma) self.advance_token();
        }
        if (self.curKind() == .rbracket) self.advance_token();
        if (has_strings) {
            initial = .{ .string_array = .{ .values = str_vals, .count = arr_cnt } };
        } else {
            initial = .{ .array = .{ .values = arr_vals, .count = arr_cnt } };
        }
    }
    return initial;
}

fn appendStateSlot(self: *Generator, getter: []const u8, setter: []const u8, initial: codegen.StateInitial) ?u32 {
    // Deduplicate — top-level and App-body scans can find the same hook
    for (0..self.state_count) |i| {
        if (std.mem.eql(u8, self.state_slots[i].getter, getter)) return @intCast(i);
    }

    if (self.state_count >= codegen.MAX_STATE_SLOTS) {
        self.setError("Too many state slots (limit: 128)");
        return null;
    }

    const slot_id = self.state_count;
    self.state_slots[slot_id] = .{
        .getter = getter,
        .setter = setter,
        .initial = initial,
    };
    self.state_count += 1;
    self.has_state = true;
    return slot_id;
}

fn skipHookCallRemainder(self: *Generator) void {
    var depth: u32 = 1;
    while (depth > 0 and self.curKind() != .eof) {
        if (self.curKind() == .lparen) {
            depth += 1;
        } else if (self.curKind() == .rparen) {
            depth -= 1;
        }
        self.advance_token();
    }
    if (self.curKind() == .semicolon) self.advance_token();
}

fn stripQuotes(text: []const u8) []const u8 {
    if (text.len >= 2 and (text[0] == '"' or text[0] == '\'') and text[text.len - 1] == text[0]) {
        return text[1 .. text.len - 1];
    }
    return text;
}

fn parseEasingKind(name: []const u8) ?codegen.EasingKind {
    if (std.mem.eql(u8, name, "linear")) return .linear;
    if (std.mem.eql(u8, name, "easeIn")) return .ease_in;
    if (std.mem.eql(u8, name, "easeOut")) return .ease_out;
    if (std.mem.eql(u8, name, "easeInOut")) return .ease_in_out;
    return null;
}

fn hasAnimHookForSlot(self: *Generator, slot_id: u32) bool {
    for (0..self.anim_hook_count) |i| {
        if (self.anim_hooks[i].slot_id == slot_id) return true;
    }
    return false;
}

fn collectObjectStateHook(self: *Generator, getter: []const u8, setter: []const u8) void {
    const obj_id = self.obj_state_count;
    var fields: [codegen.MAX_OBJECT_STATE_FIELDS]codegen.ObjectField = undefined;
    var field_count: u32 = 0;

    self.advance_token(); // {
    while (self.curKind() != .rbrace and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const field_name = self.curText();
            self.advance_token();
            if (self.curKind() == .colon) self.advance_token();

            const initial = parseStateInitial(self);
            const slot_getter = std.fmt.allocPrint(self.alloc, "{s}.{s}", .{ getter, field_name }) catch "";
            const slot_setter = std.fmt.allocPrint(self.alloc, "__obj_{d}_{s}", .{ obj_id, field_name }) catch "";
            const slot_id = appendStateSlot(self, slot_getter, slot_setter, initial);

            if (slot_id) |sid| {
                if (field_count < codegen.MAX_OBJECT_STATE_FIELDS) {
                    fields[field_count] = .{
                        .field_name = field_name,
                        .slot_id = sid,
                        .state_type = std.meta.activeTag(initial),
                    };
                    field_count += 1;
                } else {
                    self.setError("Too many object state fields (limit: 16)");
                }
            }
        } else {
            self.advance_token();
        }
        if (self.curKind() == .comma) self.advance_token();
    }
    if (self.curKind() == .rbrace) self.advance_token();

    if (self.obj_state_count < codegen.MAX_OBJECT_STATE_VARS) {
        self.obj_state_vars[self.obj_state_count] = .{
            .getter = getter,
            .setter = setter,
            .fields = fields,
            .field_count = field_count,
        };
        self.obj_state_count += 1;
    } else {
        self.setError("Too many object state declarations (limit: 16)");
    }
}

/// Recursively parse object fields, flattening nested objects with underscore-joined names.
/// e.g. { config: { theme: { bg: 0 } } } → field "config_theme_bg" (int), js_path "config.theme.bg"
fn parseObjectFields(
    self: *Generator,
    fields: *[codegen.MAX_OBJECT_ARRAY_FIELDS]codegen.ObjectArrayField,
    field_count: *u32,
    prefix: []const u8,
    js_prefix: []const u8,
) void {
    while (self.curKind() != .rbrace and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const raw_name = self.curText();
            self.advance_token();
            if (self.curKind() == .colon) self.advance_token();

            // Build compound name: prefix + raw_name (underscore-separated for Zig identifiers)
            const field_name = if (prefix.len > 0)
                (std.fmt.allocPrint(self.alloc, "{s}_{s}", .{ prefix, raw_name }) catch raw_name)
            else
                raw_name;

            // Build JS path: js_prefix.raw_name (dot-separated for nested property access)
            const field_js_path = if (js_prefix.len > 0)
                (std.fmt.allocPrint(self.alloc, "{s}.{s}", .{ js_prefix, raw_name }) catch raw_name)
            else
                raw_name;

            if (self.curKind() == .lbrace) {
                // Nested object — recurse with updated prefix
                self.advance_token(); // {
                parseObjectFields(self, fields, field_count, field_name, field_js_path);
                if (self.curKind() == .rbrace) self.advance_token(); // }
            } else if (self.curKind() == .lbracket) {
                // Array literal: cells: [0, 0, 0] → flatten into cells_0, cells_1, cells_2
                self.advance_token(); // [
                var arr_idx: u32 = 0;
                while (self.curKind() != .rbracket and self.curKind() != .eof) {
                    if (self.curKind() == .comma) { self.advance_token(); continue; }
                    const en = std.fmt.allocPrint(self.alloc, "{s}_{d}", .{ field_name, arr_idx }) catch field_name;
                    const ep = std.fmt.allocPrint(self.alloc, "{s}[{d}]", .{ field_js_path, arr_idx }) catch field_js_path;
                    var et: codegen.StateType = .int;
                    if (self.curKind() == .number) {
                        if (std.mem.indexOf(u8, self.curText(), ".") != null) et = .float;
                        self.advance_token();
                    } else if (self.curKind() == .string) {
                        et = .string; self.advance_token();
                    } else { self.advance_token(); }
                    if (field_count.* < codegen.MAX_OBJECT_ARRAY_FIELDS) {
                        fields[field_count.*] = .{ .name = en, .field_type = et, .js_path = ep };
                        field_count.* += 1;
                    }
                    arr_idx += 1;
                }
                if (self.curKind() == .rbracket) self.advance_token(); // ]
            } else {
                // Leaf value — infer type
                var field_type: codegen.StateType = .int;
                if (self.curKind() == .number) {
                    const num_text = self.curText();
                    if (std.mem.indexOf(u8, num_text, ".") != null) {
                        field_type = .float;
                    }
                    self.advance_token();
                } else if (self.curKind() == .string) {
                    field_type = .string;
                    self.advance_token();
                } else if (self.curKind() == .identifier) {
                    const val = self.curText();
                    if (std.mem.eql(u8, val, "true") or std.mem.eql(u8, val, "false")) {
                        field_type = .boolean;
                    }
                    self.advance_token();
                } else if (self.curKind() == .minus) {
                    self.advance_token();
                    if (self.curKind() == .number) {
                        const num_text = self.curText();
                        if (std.mem.indexOf(u8, num_text, ".") != null) field_type = .float;
                        self.advance_token();
                    }
                } else {
                    self.advance_token();
                }

                if (field_count.* < codegen.MAX_OBJECT_ARRAY_FIELDS) {
                    fields[field_count.*] = .{
                        .name = field_name,
                        .field_type = field_type,
                        .js_path = field_js_path,
                    };
                    field_count.* += 1;
                }
            }
        } else {
            self.advance_token();
        }
        if (self.curKind() == .comma) self.advance_token();
    }
}

/// Parse an object array hook: useState([{ field: value, ... }])
/// Extracts field names and types from the first object literal in the array.
/// Does NOT create normal state slots — registers an ObjectArrayInfo instead.
fn collectObjectArrayHook(self: *Generator, getter: []const u8, setter: []const u8) void {
    // Deduplicate
    if (self.isObjectArray(getter) != null) {
        // Skip past the array literal
        var depth: u32 = 1;
        while (depth > 0 and self.curKind() != .eof) {
            if (self.curKind() == .lbracket) depth += 1;
            if (self.curKind() == .rbracket) depth -= 1;
            if (depth > 0) self.advance_token();
        }
        if (self.curKind() == .rbracket) self.advance_token();
        return;
    }

    self.advance_token(); // [
    if (self.curKind() != .lbrace) return;
    self.advance_token(); // {

    var fields: [codegen.MAX_OBJECT_ARRAY_FIELDS]codegen.ObjectArrayField = undefined;
    var field_count: u32 = 0;

    // Parse fields from the first object literal (with recursive nesting)
    parseObjectFields(self, &fields, &field_count, "", "");
    if (self.curKind() == .rbrace) self.advance_token(); // }

    // Skip past any remaining objects in the array (we only need the schema from the first)
    while (self.curKind() != .rbracket and self.curKind() != .eof) {
        self.advance_token();
    }
    if (self.curKind() == .rbracket) self.advance_token(); // ]

    if (self.object_array_count < codegen.MAX_OBJECT_ARRAYS) {
        self.object_arrays[self.object_array_count] = .{
            .getter = getter,
            .setter = setter,
            .fields = fields,
            .field_count = field_count,
        };
        self.object_array_count += 1;
    } else {
        self.setError("Too many object array declarations (limit: 16)");
    }
}

/// Core state hook scanner — handles four patterns:
///
///   useState: const [getter, setter] = useState(initialValue)
///     → creates a StateSlot with getter name, setter name, and typed initial value
///     → initial can be: number, float, string, boolean, or array literal
///
///   useFFI: const [getter] = useFFI(funcName, intervalMs)
///     → creates a StateSlot (read-only, no setter) + an FFIHook for periodic polling
///     → the FFI function's return type (from collectDeclaredFunctions) determines slot type
///
///   useTransition: useTransition(opacity, target, durationMs, "easeInOut")
///     → registers a per-frame transition update for an existing float state slot
///
///   useSpring: useSpring(x, target, stiffness, damping)
///     → registers a spring update for an existing float state slot and auto-allocates
///       a hidden float velocity slot
///
/// The stop_at_return flag controls scope:
///   false = scan entire source (top-level hooks)
///   true  = scan until `return` keyword (App function body only)
pub fn scanForUseState(self: *Generator, stop_at_return: bool) void {
    while (self.pos < self.lex.count) {
        if (self.isIdent("const") or self.isIdent("let")) {
            self.advance_token();

            // const filtered = items.filter(item => expr)
            // const parts = text.split(",")
            if (self.curKind() == .identifier) {
                const var_name = self.curText();
                // Look ahead: identifier = source.filter(  or  identifier = source.split(
                const look_base = self.pos;
                if (look_base + 4 < self.lex.count and
                    self.lex.get(look_base + 1).kind == .equals and
                    self.lex.get(look_base + 2).kind == .identifier and
                    self.lex.get(look_base + 3).kind == .dot and
                    self.lex.get(look_base + 4).kind == .identifier)
                {
                    const source_name = self.lex.get(look_base + 2).text(self.source);
                    const method = self.lex.get(look_base + 4).text(self.source);

                    // .filter(): const filtered = items.filter(item => item > 5)
                    if (std.mem.eql(u8, method, "filter")) {
                        if (self.isArrayState(source_name)) |state_idx| {
                            self.advance_token(); // var_name
                            self.advance_token(); // =
                            self.advance_token(); // source_name
                            self.advance_token(); // .
                            self.advance_token(); // filter
                            if (self.curKind() == .lparen) self.advance_token(); // (
                            if (self.curKind() == .lparen) self.advance_token(); // optional inner (
                            const param_name = self.curText();
                            self.advance_token(); // param
                            if (self.curKind() == .rparen) self.advance_token(); // optional inner )
                            if (self.curKind() == .arrow) self.advance_token(); // =>

                            // Push param as local var to resolve in predicate
                            const saved_lc = self.local_count;
                            if (self.local_count < codegen.MAX_LOCALS) {
                                self.local_vars[self.local_count] = .{ .name = param_name, .expr = "_item", .state_type = .int };
                                self.local_count += 1;
                            }
                            const pred_expr = handlers.emitStateExpr(self) catch "";
                            self.local_count = saved_lc;

                            if (self.curKind() == .rparen) self.advance_token(); // closing )
                            // Deduplicate — top-level and App-body scans can find the same declaration
                            if (self.isComputedArray(var_name) != null) {
                                if (self.curKind() == .semicolon) self.advance_token();
                                continue;
                            }
                            if (self.computed_count < codegen.MAX_COMPUTED_ARRAYS) {
                                self.computed_arrays[self.computed_count] = .{
                                    .name = var_name,
                                    .kind = .filter,
                                    .element_type = .int,
                                    .source_slot = self.arraySlotId(state_idx),
                                    .predicate_expr = pred_expr,
                                    .predicate_param = param_name,
                                    .separator = "",
                                };
                                self.computed_count += 1;
                            } else {
                                self.setError("Too many computed arrays (limit: 16)");
                            }
                            if (self.curKind() == .semicolon) self.advance_token();
                            continue;
                        }
                    }

                    // .split(): const parts = text.split(",")
                    if (std.mem.eql(u8, method, "split")) {
                        if (self.isState(source_name)) |state_idx| {
                            if (self.stateTypeById(state_idx) == .string) {
                                self.advance_token(); // var_name
                                self.advance_token(); // =
                                self.advance_token(); // source_name
                                self.advance_token(); // .
                                self.advance_token(); // split
                                if (self.curKind() == .lparen) self.advance_token(); // (
                                var sep: []const u8 = ",";
                                if (self.curKind() == .string) {
                                    const raw = self.curText();
                                    sep = if (raw.len >= 2) raw[1 .. raw.len - 1] else raw;
                                    self.advance_token();
                                }
                                if (self.curKind() == .rparen) self.advance_token(); // )
                                if (self.isComputedArray(var_name) != null) {
                                    if (self.curKind() == .semicolon) self.advance_token();
                                    continue;
                                }
                                if (self.computed_count < codegen.MAX_COMPUTED_ARRAYS) {
                                    self.computed_arrays[self.computed_count] = .{
                                        .name = var_name,
                                        .kind = .split,
                                        .element_type = .string,
                                        .source_slot = self.regularSlotId(state_idx),
                                        .predicate_expr = "",
                                        .predicate_param = "",
                                        .separator = sep,
                                    };
                                    self.computed_count += 1;
                                } else {
                                    self.setError("Too many computed arrays (limit: 16)");
                                }
                                if (self.curKind() == .semicolon) self.advance_token();
                                continue;
                            }
                        }
                    }
                }
            }

            if (self.curKind() == .lbracket) {
                self.advance_token();
                if (self.curKind() == .identifier) {
                    const getter = self.curText();
                    self.advance_token();

                    // useFFI: const [name] = useFFI(func, interval)
                    if (self.curKind() == .rbracket) {
                        self.advance_token();
                        if (self.curKind() == .equals) self.advance_token();
                        if (self.isIdent("useFFI")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            var ffi_func_name: []const u8 = "";
                            if (self.curKind() == .identifier) {
                                ffi_func_name = self.curText();
                                self.advance_token();
                            }
                            if (self.curKind() == .comma) self.advance_token();
                            var interval_ms: u32 = 1000;
                            if (self.curKind() == .number) {
                                interval_ms = std.fmt.parseInt(u32, self.curText(), 10) catch 1000;
                                self.advance_token();
                            }
                            if (self.curKind() == .rparen) self.advance_token();

                            const ret_type = self.ffiReturnType(ffi_func_name);
                            const initial: codegen.StateInitial = switch (ret_type) {
                                .string => .{ .string = "" },
                                .boolean => .{ .boolean = false },
                                .float => .{ .float = 0.0 },
                                else => .{ .int = 0 },
                            };
                            if (self.state_count < codegen.MAX_STATE_SLOTS) {
                                const slot_id = self.state_count;
                                self.state_slots[slot_id] = .{
                                    .getter = getter,
                                    .setter = "",
                                    .initial = initial,
                                };
                                self.state_count += 1;
                                self.has_state = true;

                                if (self.ffi_hook_count < codegen.MAX_FFI_HOOKS) {
                                    self.ffi_hooks[self.ffi_hook_count] = .{
                                        .getter = getter,
                                        .ffi_func = ffi_func_name,
                                        .interval_ms = interval_ms,
                                        .return_type = ret_type,
                                        .slot_id = slot_id,
                                    };
                                    self.ffi_hook_count += 1;
                                }
                            }
                            if (self.curKind() == .semicolon) self.advance_token();
                            continue;
                        }
                        continue;
                    }

                    // useState: const [getter, setter] = useState(initial)
                    if (self.curKind() == .comma) self.advance_token();
                    if (self.curKind() == .identifier) {
                        const setter = self.curText();
                        self.advance_token();
                        if (self.curKind() == .rbracket) self.advance_token();
                        if (self.curKind() == .equals) self.advance_token();
                        if (self.isIdent("useState")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            // Object array: useState([{...}])
                            if (self.curKind() == .lbracket and
                                self.pos + 1 < self.lex.count and
                                self.lex.get(self.pos + 1).kind == .lbrace)
                            {
                                collectObjectArrayHook(self, getter, setter);
                                if (self.curKind() == .rparen) self.advance_token();
                                if (self.curKind() == .semicolon) self.advance_token();
                                continue;
                            }
                            // Single object: useState({...})
                            if (self.curKind() == .lbrace) {
                                collectObjectStateHook(self, getter, setter);
                                if (self.curKind() == .rparen) self.advance_token();
                                if (self.curKind() == .semicolon) self.advance_token();
                                continue;
                            }
                            const initial = parseStateInitial(self);
                            if (self.curKind() == .rparen) self.advance_token();
                            _ = appendStateSlot(self, getter, setter, initial);
                        }
                    }
                }
            }
        }
        if (stop_at_return and (self.isIdent("useTransition") or self.isIdent("useSpring"))) {
            const is_spring = self.isIdent("useSpring");
            const hook_name = self.curText();
            const hook_start = self.cur().start;
            self.advance_token();

            if (self.curKind() != .lparen) {
                self.setError(std.fmt.allocPrint(self.alloc, "{s} requires parentheses", .{hook_name}) catch "animation hook requires parentheses");
                continue;
            }
            self.advance_token();

            if (self.curKind() != .identifier) {
                self.setError(std.fmt.allocPrint(self.alloc, "{s} expects a state getter as its first argument", .{hook_name}) catch "animation hook expects a state getter");
                skipHookCallRemainder(self);
                continue;
            }

            const getter_name = self.curText();
            const slot_id = self.isState(getter_name) orelse {
                self.setError(std.fmt.allocPrint(self.alloc, "{s} expects an existing state getter, got '{s}'", .{ hook_name, getter_name }) catch "animation hook expects a state getter");
                skipHookCallRemainder(self);
                continue;
            };

            if (self.stateTypeById(slot_id) != .float) {
                self.setError(std.fmt.allocPrint(self.alloc, "{s} only supports float state slots ('{s}' is not float)", .{ hook_name, getter_name }) catch "animation hook requires float state");
                skipHookCallRemainder(self);
                continue;
            }

            if (hasAnimHookForSlot(self, slot_id)) {
                self.setError(std.fmt.allocPrint(self.alloc, "state '{s}' already has an animation hook", .{getter_name}) catch "duplicate animation hook");
                skipHookCallRemainder(self);
                continue;
            }

            if (self.anim_hook_count >= codegen.MAX_ANIM_HOOKS) {
                self.setError("Too many animation hooks (limit: 16)");
                skipHookCallRemainder(self);
                continue;
            }

            self.advance_token();
            if (self.curKind() != .comma) {
                self.setError(std.fmt.allocPrint(self.alloc, "{s} is missing its target expression", .{hook_name}) catch "animation hook missing target expression");
                skipHookCallRemainder(self);
                continue;
            }
            self.advance_token();

            const target_expr = handlers.emitStateExpr(self) catch {
                self.setError(std.fmt.allocPrint(self.alloc, "failed to parse target expression for {s}({s}, ...)", .{ hook_name, getter_name }) catch "failed to parse animation target expression");
                skipHookCallRemainder(self);
                continue;
            };

            if (self.curKind() != .comma) {
                self.setError(std.fmt.allocPrint(self.alloc, "{s} is missing its numeric parameters", .{hook_name}) catch "animation hook missing parameters");
                skipHookCallRemainder(self);
                continue;
            }
            self.advance_token();

            var duration_ms: u32 = 0;
            var easing: codegen.EasingKind = .linear;
            var stiffness: f32 = 0.0;
            var damping: f32 = 0.0;

            if (is_spring) {
                if (self.curKind() != .number) {
                    self.setError("useSpring stiffness must be a numeric literal");
                    skipHookCallRemainder(self);
                    continue;
                }
                stiffness = std.fmt.parseFloat(f32, self.curText()) catch 120.0;
                self.advance_token();

                if (self.curKind() != .comma) {
                    self.setError("useSpring is missing its damping argument");
                    skipHookCallRemainder(self);
                    continue;
                }
                self.advance_token();

                if (self.curKind() != .number) {
                    self.setError("useSpring damping must be a numeric literal");
                    skipHookCallRemainder(self);
                    continue;
                }
                damping = std.fmt.parseFloat(f32, self.curText()) catch 14.0;
                self.advance_token();
            } else {
                if (self.curKind() != .number) {
                    self.setError("useTransition duration must be an integer literal in milliseconds");
                    skipHookCallRemainder(self);
                    continue;
                }
                duration_ms = std.fmt.parseInt(u32, self.curText(), 10) catch 300;
                self.advance_token();

                if (self.curKind() != .comma) {
                    self.setError("useTransition is missing its easing argument");
                    skipHookCallRemainder(self);
                    continue;
                }
                self.advance_token();

                if (self.curKind() != .string) {
                    self.setError("useTransition easing must be a string literal");
                    skipHookCallRemainder(self);
                    continue;
                }

                const easing_name = stripQuotes(self.curText());
                easing = parseEasingKind(easing_name) orelse {
                    self.setErrorAt(hook_start, std.fmt.allocPrint(self.alloc, "unsupported easing '{s}' in useTransition", .{easing_name}) catch "unsupported easing");
                    skipHookCallRemainder(self);
                    continue;
                };
                self.advance_token();
            }

            if (self.curKind() != .rparen) {
                self.setError(std.fmt.allocPrint(self.alloc, "{s} has too many arguments or is missing ')'", .{hook_name}) catch "animation hook syntax error");
                skipHookCallRemainder(self);
                continue;
            }
            self.advance_token();
            if (self.curKind() == .semicolon) self.advance_token();

            var vel_slot_id: u32 = 0;
            if (is_spring) {
                const vel_name = std.fmt.allocPrint(self.alloc, "_vel_{d}", .{self.state_count}) catch "_vel";
                const vel_slot = appendStateSlot(self, vel_name, "", .{ .float = 0.0 }) orelse continue;
                vel_slot_id = vel_slot;
            }

            self.anim_hooks[self.anim_hook_count] = .{
                .kind = if (is_spring) .spring else .transition,
                .slot_id = slot_id,
                .vel_slot_id = vel_slot_id,
                .target_expr = target_expr,
                .duration_ms = duration_ms,
                .easing = easing,
                .stiffness = stiffness,
                .damping = damping,
            };
            self.anim_hook_count += 1;
            continue;
        }
        if (stop_at_return and self.isIdent("return")) break;
        self.advance_token();
    }
}

// ── Misc collection ──

/// Advance pos to the first token after `return` (skipping optional parens).
/// After this call, pos points at the start of the return expression (usually <JSX>).
pub fn findReturnStatement(self: *Generator) void {
    while (self.pos < self.lex.count and !self.isIdent("return")) {
        self.advance_token();
    }
    if (self.isIdent("return")) self.advance_token();
    if (self.curKind() == .lparen) self.advance_token();
}

/// Phase 5: Extract JavaScript from <script> blocks.
/// This JS gets embedded in the generated Zig as JS_LOGIC and runs in QuickJS.
/// Also extracts Lua from <lscript> blocks → LUA_LOGIC for LuaJIT runtime.
/// Scans raw source bytes (not tokens) since <script> content isn't tokenized.
/// Concatenates ALL <script>/<lscript> blocks (app + imported components) with newlines.

// ── Re-exports from collect_rewrite.zig ──
pub const extractComputeBlock = collect_rewrite.extractComputeBlock;
pub const extractZscriptBlock = collect_rewrite.extractZscriptBlock;
pub const rewriteSetterCalls = collect_rewrite.rewriteSetterCalls;
pub const rewriteLuaSetterCalls = collect_rewrite.rewriteLuaSetterCalls;
pub const rewriteZscriptState = collect_rewrite.rewriteZscriptState;
