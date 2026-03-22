//! tsz init [name] — Scaffold a new .tsz project.
//!
//! Creates a directory with:
//!   name/name.tsz          — Main component with App function
//!   name/name.script.tsz   — Empty script block
//!   name/name_cls.tsz      — Basic classifiers (Page, Card, Row, Heading, Body)
//!   name/build.sh           — Convenience build + run script

const std = @import("std");

pub fn run(alloc: std.mem.Allocator, args: []const []const u8) void {
    const name = if (args.len >= 3) args[2] else "myapp";

    // Validate name: alphanumeric + underscores only
    for (name) |c| {
        if (!std.ascii.isAlphanumeric(c) and c != '_' and c != '-') {
            std.debug.print("[tsz] Invalid project name '{s}' — use alphanumeric, _ or -\n", .{name});
            return;
        }
    }

    // Create project directory
    std.fs.cwd().makeDir(name) catch |err| {
        if (err == error.PathAlreadyExists) {
            std.debug.print("[tsz] Directory '{s}' already exists\n", .{name});
            return;
        }
        std.debug.print("[tsz] Failed to create directory '{s}': {}\n", .{ name, err });
        return;
    };

    const dir = std.fs.cwd().openDir(name, .{}) catch |err| {
        std.debug.print("[tsz] Failed to open directory '{s}': {}\n", .{ name, err });
        return;
    };

    // Write main component
    const main_tsz = std.fmt.allocPrint(alloc,
        \\import {{ Page, Card, Row, Heading, Body }} from './{s}_cls';
        \\
        \\const [count, setCount] = useState(0);
        \\
        \\function App() {{
        \\  return (
        \\    <C.Page>
        \\      <C.Card>
        \\        <C.Heading>{s}</C.Heading>
        \\        <C.Body>{{`Clicks: ${{count}}`}}</C.Body>
        \\        <C.Row>
        \\          <Pressable onPress={{() => setCount(count + 1)}} style={{{{ backgroundColor: "#3b82f6", borderRadius: 6, padding: 10, alignItems: "center" }}}}>
        \\            <Text fontSize={{12}} color="#ffffff">Click me</Text>
        \\          </Pressable>
        \\          <Pressable onPress={{() => setCount(0)}} style={{{{ backgroundColor: "#334155", borderRadius: 6, padding: 10, alignItems: "center" }}}}>
        \\            <Text fontSize={{12}} color="#94a3b8">Reset</Text>
        \\          </Pressable>
        \\        </C.Row>
        \\      </C.Card>
        \\    </C.Page>
        \\  );
        \\}}
        \\
    , .{ name, name }) catch return;

    writeFile(dir, std.fmt.allocPrint(alloc, "{s}.tsz", .{name}) catch return, main_tsz);

    // Write script file
    const script_tsz =
        \\// Script logic for the app.
        \\// Variables and functions here are available in the component scope.
        \\// Use setInterval(), console.log(), and state setters.
        \\
        \\console.log('App loaded.');
        \\
    ;
    writeFile(dir, std.fmt.allocPrint(alloc, "{s}.script.tsz", .{name}) catch return, script_tsz);

    // Write classifiers
    const cls_tsz =
        \\classifier Page: Box {
        \\  width: '100%',
        \\  height: '100%',
        \\  backgroundColor: '#0f172a',
        \\  padding: 24,
        \\  gap: 16,
        \\  alignItems: 'center',
        \\  justifyContent: 'center',
        \\}
        \\
        \\classifier Card: Box {
        \\  backgroundColor: '#1e293b',
        \\  borderRadius: 12,
        \\  padding: 20,
        \\  gap: 12,
        \\  borderColor: '#334155',
        \\  borderWidth: 1,
        \\  width: 320,
        \\}
        \\
        \\classifier Row: Box {
        \\  flexDirection: 'row',
        \\  gap: 8,
        \\  alignItems: 'center',
        \\}
        \\
        \\classifier Heading: Text {
        \\  fontSize: 20,
        \\  color: '#f1f5f9',
        \\}
        \\
        \\classifier Body: Text {
        \\  fontSize: 14,
        \\  color: '#94a3b8',
        \\}
        \\
    ;
    writeFile(dir, std.fmt.allocPrint(alloc, "{s}_cls.tsz", .{name}) catch return, cls_tsz);

    // Write build script
    const build_sh = std.fmt.allocPrint(alloc,
        \\#!/bin/bash
        \\# Build and run {s}
        \\set -e
        \\cd "$(dirname "$0")/.."
        \\./zig-out/bin/zigos-compiler build carts/{s}/{s}.tsz
        \\echo "Running {s}..."
        \\./zig-out/bin/{s}
        \\
    , .{ name, name, name, name, name }) catch return;
    writeFile(dir, "build.sh", build_sh);

    // Make build.sh executable
    const build_path = std.fmt.allocPrint(alloc, "{s}/build.sh", .{name}) catch return;
    const build_file = std.fs.cwd().openFile(build_path, .{ .mode = .read_write }) catch return;
    defer build_file.close();
    build_file.chmod(0o755) catch {};

    std.debug.print(
        \\[tsz] Created project '{s}/'
        \\
        \\  {s}/{s}.tsz          — Main component
        \\  {s}/{s}.script.tsz   — Script logic
        \\  {s}/{s}_cls.tsz      — Classifiers
        \\  {s}/build.sh          — Build + run
        \\
        \\Next: ./zig-out/bin/zigos-compiler build carts/{s}/{s}.tsz
        \\
    , .{ name, name, name, name, name, name, name, name, name, name });
}

fn writeFile(dir: std.fs.Dir, filename: []const u8, content: []const u8) void {
    const f = dir.createFile(filename, .{}) catch |err| {
        std.debug.print("[tsz] Failed to create {s}: {}\n", .{ filename, err });
        return;
    };
    defer f.close();
    f.writeAll(content) catch |err| {
        std.debug.print("[tsz] Failed to write {s}: {}\n", .{ filename, err });
    };
}
