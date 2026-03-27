//! Tests for attrs.zig — attribute parsing, style keys, colors, CSS values
const h = @import("test_helpers.zig");
const std = h.std;
const testing = h.testing;
const arena = h.arena;
const Lexer = h.Lexer;
const Generator = h.Generator;
const attrs = @import("../attrs.zig");

test "kebabToCamel basic" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings("flexDirection", try attrs.kebabToCamel(a.allocator(), "flex-direction")); }
test "kebabToCamel multiple" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings("borderTopLeftRadius", try attrs.kebabToCamel(a.allocator(), "border-top-left-radius")); }
test "kebabToCamel no hyphens" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings("width", try attrs.kebabToCamel(a.allocator(), "width")); }

test "parseCSSValue plain number" { try testing.expectEqual(@as(f32, 42.0), attrs.parseCSSValue("42").?); }
test "parseCSSValue px" { try testing.expectEqual(@as(f32, 16.0), attrs.parseCSSValue("16px").?); }
test "parseCSSValue rem" { try testing.expectEqual(@as(f32, 32.0), attrs.parseCSSValue("2rem").?); }
test "parseCSSValue percent" { try testing.expectEqual(@as(f32, 50.0), attrs.parseCSSValue("50%").?); }
test "parseCSSValue auto" { try testing.expect(attrs.parseCSSValue("auto") == null); }
test "parseCSSValue empty" { try testing.expect(attrs.parseCSSValue("") == null); }

test "namedColor" {
    try testing.expectEqual(@as(u8, 0), attrs.namedColor("black").?[0]);
    try testing.expectEqual(@as(u8, 255), attrs.namedColor("white").?[0]);
    try testing.expectEqual(@as(u8, 255), attrs.namedColor("red").?[0]);
    try testing.expectEqual(attrs.namedColor("gray").?[0], attrs.namedColor("grey").?[0]);
    try testing.expect(attrs.namedColor("banana") == null);
}

test "mapStyleKey" {
    try testing.expectEqualStrings("width", attrs.mapStyleKey("width").?);
    try testing.expectEqualStrings("flex_grow", attrs.mapStyleKey("flexGrow").?);
    try testing.expectEqualStrings("padding_left", attrs.mapStyleKey("paddingLeft").?);
    try testing.expectEqualStrings("border_radius", attrs.mapStyleKey("borderRadius").?);
    try testing.expect(attrs.mapStyleKey("banana") == null);
    try testing.expect(attrs.mapStyleKey("backgroundColor") == null);
}

test "mapStyleKeyI16" { try testing.expectEqualStrings("z_index", attrs.mapStyleKeyI16("zIndex").?); try testing.expect(attrs.mapStyleKeyI16("width") == null); }
test "mapColorKey" { try testing.expectEqualStrings("background_color", attrs.mapColorKey("backgroundColor").?); try testing.expect(attrs.mapColorKey("width") == null); }

test "mapEnumKey" {
    const fd = attrs.mapEnumKey("flexDirection").?;
    try testing.expectEqualStrings("flex_direction", fd.field);
    try testing.expectEqualStrings("fd", fd.prefix);
    try testing.expect(attrs.mapEnumKey("width") == null);
}

test "mapEnumValue" {
    try testing.expectEqualStrings(".row", attrs.mapEnumValue("fd", "row").?);
    try testing.expectEqualStrings(".center", attrs.mapEnumValue("jc", "center").?);
    try testing.expectEqualStrings(".space_between", attrs.mapEnumValue("jc", "space-between").?);
    try testing.expectEqualStrings(".stretch", attrs.mapEnumValue("ai", "stretch").?);
    try testing.expectEqualStrings(".hidden", attrs.mapEnumValue("ov", "hidden").?);
    try testing.expectEqualStrings(".absolute", attrs.mapEnumValue("pos", "absolute").?);
    try testing.expect(attrs.mapEnumValue("fd", "banana") == null);
}

test "parseColorValue 6-digit hex" {
    var a = arena(); defer a.deinit(); var lex = h.tokenize(""); var gen = h.makeGen(a.allocator(), &lex, "");
    try testing.expectEqualStrings("Color.rgb(255, 0, 0)", try attrs.parseColorValue(&gen, "#ff0000"));
}
test "parseColorValue 3-digit hex" {
    var a = arena(); defer a.deinit(); var lex = h.tokenize(""); var gen = h.makeGen(a.allocator(), &lex, "");
    try testing.expectEqualStrings("Color.rgb(255, 0, 0)", try attrs.parseColorValue(&gen, "#f00"));
}
test "parseColorValue 8-digit hex" {
    var a = arena(); defer a.deinit(); var lex = h.tokenize(""); var gen = h.makeGen(a.allocator(), &lex, "");
    const r = try attrs.parseColorValue(&gen, "#ff000080");
    try testing.expect(std.mem.indexOf(u8, r, "rgba") != null);
}
test "parseColorValue named" {
    var a = arena(); defer a.deinit(); var lex = h.tokenize(""); var gen = h.makeGen(a.allocator(), &lex, "");
    try testing.expectEqualStrings("Color.rgb(255, 0, 0)", try attrs.parseColorValue(&gen, "red"));
}
test "parseColorValue empty" {
    var a = arena(); defer a.deinit(); var lex = h.tokenize(""); var gen = h.makeGen(a.allocator(), &lex, "");
    try testing.expectEqualStrings("Color.rgb(255, 255, 255)", try attrs.parseColorValue(&gen, ""));
}

test "parseColorValue theme-bg" {
    var a = arena(); defer a.deinit(); var lex = h.tokenize(""); var gen = h.makeGen(a.allocator(), &lex, "");
    try testing.expectEqualStrings("Theme.get(.bg)", try attrs.parseColorValue(&gen, "theme-bg"));
    try testing.expect(gen.has_theme);
}
test "parseColorValue theme-bgAlt" {
    var a = arena(); defer a.deinit(); var lex = h.tokenize(""); var gen = h.makeGen(a.allocator(), &lex, "");
    try testing.expectEqualStrings("Theme.get(.bg_alt)", try attrs.parseColorValue(&gen, "theme-bgAlt"));
}
test "parseColorValue theme-text" {
    var a = arena(); defer a.deinit(); var lex = h.tokenize(""); var gen = h.makeGen(a.allocator(), &lex, "");
    try testing.expectEqualStrings("Theme.get(.text)", try attrs.parseColorValue(&gen, "theme-text"));
}
test "parseColorValue theme-primary" {
    var a = arena(); defer a.deinit(); var lex = h.tokenize(""); var gen = h.makeGen(a.allocator(), &lex, "");
    try testing.expectEqualStrings("Theme.get(.primary)", try attrs.parseColorValue(&gen, "theme-primary"));
}
test "parseColorValue theme-error" {
    var a = arena(); defer a.deinit(); var lex = h.tokenize(""); var gen = h.makeGen(a.allocator(), &lex, "");
    try testing.expectEqualStrings("Theme.get(.@\"error\")", try attrs.parseColorValue(&gen, "theme-error"));
}
test "parseColorValue theme-unknown returns magenta" {
    var a = arena(); defer a.deinit(); var lex = h.tokenize(""); var gen = h.makeGen(a.allocator(), &lex, "");
    try testing.expectEqualStrings("Color.rgb(255, 0, 255)", try attrs.parseColorValue(&gen, "theme-banana"));
    try testing.expect(!gen.has_theme);
}

test "parseStringAttr" {
    var a = arena(); defer a.deinit();
    var lex = Lexer.init("\"hello\""); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, "\"hello\"", "test.tsz");
    try testing.expectEqualStrings("hello", try attrs.parseStringAttr(&gen));
}

test "parseExprAttr braced" {
    var a = arena(); defer a.deinit();
    var lex = Lexer.init("{42}"); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, "{42}", "test.tsz");
    try testing.expectEqualStrings("42", try attrs.parseExprAttr(&gen));
}

test "parseExprAttr braced map item field access" {
    var a = arena(); defer a.deinit();
    const src = "{token.zoom}";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    gen.map_item_param = "token";
    gen.map_obj_array_idx = 0;
    gen.object_arrays[0] = undefined;
    gen.object_arrays[0].getter = "tokens";
    gen.object_arrays[0].setter = "setTokens";
    gen.object_arrays[0].field_count = 1;
    gen.object_arrays[0].fields[0] = .{ .name = "zoom", .field_type = .float };
    try testing.expectEqualStrings("_oa0_zoom[_i]", try attrs.parseExprAttr(&gen));
}

test "parseStyleAttr" {
    var a = arena(); defer a.deinit();
    const src = "{{ width: 100, height: 50 }}";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    const r = try attrs.parseStyleAttr(&gen);
    try testing.expect(std.mem.indexOf(u8, r, ".width = 100") != null);
    try testing.expect(std.mem.indexOf(u8, r, ".height = 50") != null);
}

test "skipBalanced" {
    var a = arena(); defer a.deinit();
    const src = "{ nested { deep } } after";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    try attrs.skipBalanced(&gen);
    try testing.expectEqualStrings("after", gen.curText());
}
