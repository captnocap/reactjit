//! Tests for handlers.zig — expression chain and handler body emission
const h = @import("test_helpers.zig");
const std = h.std;
const testing = h.testing;
const arena = h.arena;
const Lexer = h.Lexer;
const Generator = h.Generator;
const handlers = h.handlers;
const exprResult = h.exprResult;
const exprWithState = h.exprWithState;

test "number literal" {
    var a = arena();
    defer a.deinit();
    try testing.expectEqualStrings("42", try exprResult(a.allocator(), "42"));
}
test "boolean true" {
    var a = arena();
    defer a.deinit();
    try testing.expectEqualStrings("true", try exprResult(a.allocator(), "true"));
}
test "boolean false" {
    var a = arena();
    defer a.deinit();
    try testing.expectEqualStrings("false", try exprResult(a.allocator(), "false"));
}
test "double-quoted string" {
    var a = arena();
    defer a.deinit();
    try testing.expectEqualStrings("\"hello\"", try exprResult(a.allocator(), "\"hello\""));
}

test "single-quoted string converts to double" {
    var a = arena();
    defer a.deinit();
    try testing.expectEqualStrings("\"hello\"", try exprResult(a.allocator(), "'hello'"));
}

test "negation" {
    var a = arena();
    defer a.deinit();
    const r = try exprResult(a.allocator(), "!true");
    try testing.expect(std.mem.indexOf(u8, r, "!") != null);
}
test "unary minus" {
    var a = arena();
    defer a.deinit();
    const r = try exprResult(a.allocator(), "-5");
    try testing.expect(std.mem.indexOf(u8, r, "-") != null);
}

test "addition" {
    var a = arena();
    defer a.deinit();
    const r = try exprResult(a.allocator(), "1 + 2");
    try testing.expect(std.mem.indexOf(u8, r, "+") != null);
}
test "subtraction" {
    var a = arena();
    defer a.deinit();
    const r = try exprResult(a.allocator(), "10 - 3");
    try testing.expect(std.mem.indexOf(u8, r, "-") != null);
}
test "multiplication" {
    var a = arena();
    defer a.deinit();
    const r = try exprResult(a.allocator(), "4 * 5");
    try testing.expect(std.mem.indexOf(u8, r, "*") != null);
}
test "division" {
    var a = arena();
    defer a.deinit();
    const r = try exprResult(a.allocator(), "10 / 2");
    try testing.expect(std.mem.indexOf(u8, r, "/") != null);
}
test "equality" {
    var a = arena();
    defer a.deinit();
    try testing.expect(std.mem.indexOf(u8, try exprResult(a.allocator(), "1 == 2"), "==") != null);
}
test "inequality" {
    var a = arena();
    defer a.deinit();
    try testing.expect(std.mem.indexOf(u8, try exprResult(a.allocator(), "1 != 2"), "!=") != null);
}
test "less than" {
    var a = arena();
    defer a.deinit();
    try testing.expect(std.mem.indexOf(u8, try exprResult(a.allocator(), "1 < 2"), "<") != null);
}

test "logical AND becomes 'and'" {
    var a = arena();
    defer a.deinit();
    try testing.expect(std.mem.indexOf(u8, try exprResult(a.allocator(), "true && false"), " and ") != null);
}
test "logical OR becomes 'or'" {
    var a = arena();
    defer a.deinit();
    try testing.expect(std.mem.indexOf(u8, try exprResult(a.allocator(), "true || false"), " or ") != null);
}

test "ternary with bool" {
    var a = arena();
    defer a.deinit();
    const r = try exprResult(a.allocator(), "true ? 1 : 0");
    try testing.expect(std.mem.indexOf(u8, r, "if") != null);
    try testing.expect(std.mem.indexOf(u8, r, "else") != null);
}

test "ternary with comparison" {
    var a = arena();
    defer a.deinit();
    const r = try exprResult(a.allocator(), "1 == 1 ? 10 : 20");
    try testing.expect(std.mem.indexOf(u8, r, "if") != null);
    try testing.expect(std.mem.indexOf(u8, r, "==") != null);
}

test "parenthesized" {
    var a = arena();
    defer a.deinit();
    const r = try exprResult(a.allocator(), "(1 + 2)");
    try testing.expect(std.mem.indexOf(u8, r, "+") != null);
}

test "state int resolves to getSlot" {
    var a = arena();
    defer a.deinit();
    try testing.expect(std.mem.indexOf(u8, try exprWithState(a.allocator(), "count"), "state.getSlot(") != null);
}
test "state string resolves to getSlotString" {
    var a = arena();
    defer a.deinit();
    try testing.expect(std.mem.indexOf(u8, try exprWithState(a.allocator(), "name"), "state.getSlotString(") != null);
}
test "state float resolves to getSlotFloat" {
    var a = arena();
    defer a.deinit();
    try testing.expect(std.mem.indexOf(u8, try exprWithState(a.allocator(), "temp"), "state.getSlotFloat(") != null);
}
test "state bool resolves to getSlotBool" {
    var a = arena();
    defer a.deinit();
    try testing.expect(std.mem.indexOf(u8, try exprWithState(a.allocator(), "active"), "state.getSlotBool(") != null);
}

test "object state field resolves to flat slot getter" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "user.name";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    gen.state_slots[0] = .{ .getter = "user.name", .setter = "__obj_0_name", .initial = .{ .string = "alice" } };
    gen.state_slots[1] = .{ .getter = "user.age", .setter = "__obj_0_age", .initial = .{ .int = 30 } };
    gen.state_count = 2;
    gen.has_state = true;
    gen.obj_state_vars[0] = .{
        .getter = "user",
        .setter = "setUser",
        .fields = undefined,
        .field_count = 2,
    };
    gen.obj_state_vars[0].fields[0] = .{ .field_name = "name", .slot_id = 0, .state_type = .string };
    gen.obj_state_vars[0].fields[1] = .{ .field_name = "age", .slot_id = 1, .state_type = .int };
    gen.obj_state_count = 1;

    try testing.expectEqualStrings("state.getSlotString(0)", try handlers.emitStateExpr(&gen));
}

test "state + literal" {
    var a = arena();
    defer a.deinit();
    const r = try exprWithState(a.allocator(), "count + 1");
    try testing.expect(std.mem.indexOf(u8, r, "state.getSlot(") != null);
    try testing.expect(std.mem.indexOf(u8, r, "+ 1") != null);
}

test "handler body setter int" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "{() => setCount(count + 1)}";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    gen.state_slots[0] = .{ .getter = "count", .setter = "setCount", .initial = .{ .int = 0 } };
    gen.state_count = 1;
    gen.has_state = true;
    const body = try handlers.emitHandlerBody(&gen, 0);
    try testing.expect(std.mem.indexOf(u8, body, "state.setSlot(") != null);
}

test "handler body setter string" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "{() => setName(\"world\")}";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    gen.state_slots[0] = .{ .getter = "name", .setter = "setName", .initial = .{ .string = "" } };
    gen.state_count = 1;
    gen.has_state = true;
    const body = try handlers.emitHandlerBody(&gen, 0);
    try testing.expect(std.mem.indexOf(u8, body, "state.setSlotString(") != null);
}

test "handler body object setter writes only explicit fields" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "{() => setUser({ ...user, name: \"bob\", age: user.age + 1 })}";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    gen.state_slots[0] = .{ .getter = "user.name", .setter = "__obj_0_name", .initial = .{ .string = "alice" } };
    gen.state_slots[1] = .{ .getter = "user.age", .setter = "__obj_0_age", .initial = .{ .int = 30 } };
    gen.state_slots[2] = .{ .getter = "user.active", .setter = "__obj_0_active", .initial = .{ .boolean = true } };
    gen.state_count = 3;
    gen.has_state = true;
    gen.obj_state_vars[0] = .{
        .getter = "user",
        .setter = "setUser",
        .fields = undefined,
        .field_count = 3,
    };
    gen.obj_state_vars[0].fields[0] = .{ .field_name = "name", .slot_id = 0, .state_type = .string };
    gen.obj_state_vars[0].fields[1] = .{ .field_name = "age", .slot_id = 1, .state_type = .int };
    gen.obj_state_vars[0].fields[2] = .{ .field_name = "active", .slot_id = 2, .state_type = .boolean };
    gen.obj_state_count = 1;

    const body = try handlers.emitHandlerBody(&gen, 0);
    try testing.expect(std.mem.indexOf(u8, body, "state.setSlotString(0, \"bob\");") != null);
    try testing.expect(std.mem.indexOf(u8, body, "state.setSlot(1, (state.getSlot(1) + 1));") != null);
    try testing.expect(std.mem.indexOf(u8, body, "state.setSlotBool(2,") == null);
}

test "precedence: multiply before add" {
    var a = arena();
    defer a.deinit();
    const r = try exprResult(a.allocator(), "2 + 3 * 4");
    try testing.expect(std.mem.indexOf(u8, r, "+") != null);
    try testing.expect(std.mem.indexOf(u8, r, "*") != null);
}

test "precedence exact: multiply nests under add" {
    var a = arena();
    defer a.deinit();
    try testing.expectEqualStrings("(2 + (3 * 4))", try exprResult(a.allocator(), "2 + 3 * 4"));
}

test "precedence exact: logical AND binds tighter than OR" {
    var a = arena();
    defer a.deinit();
    try testing.expectEqualStrings("(true or (false and true))", try exprResult(a.allocator(), "true || false && true"));
}

test "precedence exact: ternary keeps comparison as condition" {
    var a = arena();
    defer a.deinit();
    try testing.expectEqualStrings("(if ((1 == 1)) @as(i32, 10) else @as(i32, 20))", try exprResult(a.allocator(), "1 == 1 ? 10 : 20"));
}
