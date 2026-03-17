//! Test entry point — lives at compiler/ level so all @import paths resolve
//! relative to compiler/ (the module root).
comptime {
    _ = @import("test/lexer_test.zig");
    _ = @import("test/tailwind_test.zig");
    _ = @import("test/bootstrap_test.zig");
    _ = @import("test/attrs_test.zig");
    _ = @import("test/codegen_test.zig");
    _ = @import("test/components_test.zig");
    _ = @import("test/collect_test.zig");
    _ = @import("test/handlers_test.zig");
    _ = @import("test/jsx_test.zig");
    _ = @import("test/emit_test.zig");
    _ = @import("test/lint_test.zig");
}
