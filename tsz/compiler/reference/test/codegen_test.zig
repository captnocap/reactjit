//! Tests for codegen.zig — Generator struct, helpers, type mappings
const h = @import("test_helpers.zig");
const std = h.std;
const testing = h.testing;
const arena = h.arena;
const tokenize = h.tokenize;
const makeGen = h.makeGen;
const codegen = h.codegen;
const Generator = h.Generator;
const TokenKind = h.TokenKind;

test "estimateBufSize" {
    try testing.expectEqual(@as(u32, 64), Generator.estimateBufSize("hello"));
    try testing.expectEqual(@as(u32, 64), Generator.estimateBufSize(""));
    try testing.expectEqual(@as(u32, 64), Generator.estimateBufSize("{d}"));
    try testing.expectEqual(@as(u32, 148), Generator.estimateBufSize("{d}{s}"));
    try testing.expectEqual(@as(u32, 162), Generator.estimateBufSize("Count: {d} Name: {s}"));
}

test "isIdentByte" {
    try testing.expect(Generator.isIdentByte('a'));
    try testing.expect(Generator.isIdentByte('Z'));
    try testing.expect(Generator.isIdentByte('0'));
    try testing.expect(Generator.isIdentByte('_'));
    try testing.expect(!Generator.isIdentByte(' '));
    try testing.expect(!Generator.isIdentByte('.'));
    try testing.expect(!Generator.isIdentByte('@'));
}

test "zigTypeForPropType" {
    try testing.expectEqualStrings("[]const u8", Generator.zigTypeForPropType(.string));
    try testing.expectEqualStrings("Color", Generator.zigTypeForPropType(.color));
    try testing.expectEqualStrings("u16", Generator.zigTypeForPropType(.number));
    try testing.expectEqualStrings("i64", Generator.zigTypeForPropType(.state_int));
    try testing.expectEqualStrings("f32", Generator.zigTypeForPropType(.state_float));
    try testing.expectEqualStrings("bool", Generator.zigTypeForPropType(.state_bool));
}

test "Generator.init defaults" {
    var a = arena(); defer a.deinit();
    var lex = tokenize("hello");
    const gen = makeGen(a.allocator(), &lex, "hello");
    try testing.expectEqual(@as(u32, 0), gen.pos);
    try testing.expectEqual(@as(u32, 0), gen.state_count);
    try testing.expect(!gen.has_state);
    try testing.expectEqual(@as(u32, 0), gen.component_count);
    try testing.expect(gen.compile_error == null);
    try testing.expect(!gen.is_module);
}

test "classifyExpr" {
    var a = arena(); defer a.deinit(); var lex = tokenize(""); var gen = makeGen(a.allocator(), &lex, "");
    try testing.expectEqual(codegen.PropType.string, gen.classifyExpr("\"hello\""));
    try testing.expectEqual(codegen.PropType.color, gen.classifyExpr("\"#ff0000\""));
    try testing.expectEqual(codegen.PropType.state_int, gen.classifyExpr("state.getSlot(0)"));
    try testing.expectEqual(codegen.PropType.state_float, gen.classifyExpr("state.getSlotFloat(1)"));
    try testing.expectEqual(codegen.PropType.number, gen.classifyExpr("42"));
    try testing.expectEqual(codegen.PropType.expression, gen.classifyExpr("foo + bar"));
}

test "isStringExpr" {
    var a = arena(); defer a.deinit(); var lex = tokenize(""); var gen = makeGen(a.allocator(), &lex, "");
    try testing.expect(gen.isStringExpr("\"hello\""));
    try testing.expect(gen.isStringExpr("state.getSlotString(0)"));
    try testing.expect(!gen.isStringExpr("42"));
}

test "token helpers" {
    var a = arena(); defer a.deinit();
    var lex = tokenize("hello world");
    var gen = makeGen(a.allocator(), &lex, "hello world");
    try testing.expectEqual(TokenKind.identifier, gen.curKind());
    try testing.expectEqualStrings("hello", gen.curText());
    try testing.expect(gen.isIdent("hello"));
    gen.advance_token();
    try testing.expectEqualStrings("world", gen.curText());
}

test "isSetter and isState" {
    var a = arena(); defer a.deinit(); var lex = tokenize(""); var gen = makeGen(a.allocator(), &lex, "");
    gen.state_slots[0] = .{ .getter = "count", .setter = "setCount", .initial = .{ .int = 0 } };
    gen.state_count = 1;
    try testing.expectEqual(@as(u32, 0), gen.isState("count").?);
    try testing.expect(gen.isState("unknown") == null);
    try testing.expectEqual(@as(u32, 0), gen.isSetter("setCount").?);
    try testing.expect(gen.isSetter("unknown") == null);
}

test "stateTypeById" {
    var a = arena(); defer a.deinit(); var lex = tokenize(""); var gen = makeGen(a.allocator(), &lex, "");
    gen.state_slots[0] = .{ .getter = "a", .setter = "sa", .initial = .{ .int = 0 } };
    gen.state_slots[1] = .{ .getter = "b", .setter = "sb", .initial = .{ .float = 1.0 } };
    gen.state_slots[2] = .{ .getter = "c", .setter = "sc", .initial = .{ .boolean = true } };
    gen.state_slots[3] = .{ .getter = "d", .setter = "sd", .initial = .{ .string = "hi" } };
    gen.state_count = 4;
    try testing.expectEqual(codegen.StateType.int, gen.stateTypeById(0));
    try testing.expectEqual(codegen.StateType.float, gen.stateTypeById(1));
    try testing.expectEqual(codegen.StateType.boolean, gen.stateTypeById(2));
    try testing.expectEqual(codegen.StateType.string, gen.stateTypeById(3));
}

test "regularSlotId skips arrays" {
    var a = arena(); defer a.deinit(); var lex = tokenize(""); var gen = makeGen(a.allocator(), &lex, "");
    gen.state_slots[0] = .{ .getter = "a", .setter = "sa", .initial = .{ .int = 0 } };
    gen.state_slots[1] = .{ .getter = "b", .setter = "sb", .initial = .{ .array = .{ .values = undefined, .count = 0 } } };
    gen.state_slots[2] = .{ .getter = "c", .setter = "sc", .initial = .{ .int = 5 } };
    gen.state_count = 3;
    try testing.expectEqual(@as(u32, 0), gen.regularSlotId(0));
    try testing.expectEqual(@as(u32, 1), gen.regularSlotId(1));
    try testing.expectEqual(@as(u32, 1), gen.regularSlotId(2));
}

test "findProp" {
    var a = arena(); defer a.deinit(); var lex = tokenize(""); var gen = makeGen(a.allocator(), &lex, "");
    gen.prop_stack[0] = .{ .name = "color", .value = "\"red\"" };
    gen.prop_stack[1] = .{ .name = "size", .value = "42" };
    gen.prop_stack_count = 2;
    try testing.expectEqualStrings("\"red\"", gen.findProp("color").?);
    try testing.expectEqualStrings("42", gen.findProp("size").?);
    try testing.expect(gen.findProp("unknown") == null);
}

test "findProp returns latest" {
    var a = arena(); defer a.deinit(); var lex = tokenize(""); var gen = makeGen(a.allocator(), &lex, "");
    gen.prop_stack[0] = .{ .name = "color", .value = "\"red\"" };
    gen.prop_stack[1] = .{ .name = "color", .value = "\"blue\"" };
    gen.prop_stack_count = 2;
    try testing.expectEqualStrings("\"blue\"", gen.findProp("color").?);
}
