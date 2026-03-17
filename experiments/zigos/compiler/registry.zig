//! tsz project registry — tracks registered .tsz projects
//!
//! Persists to ~/.config/tsz/projects.json.
//! Simple JSON format, read/written via std.json.

const std = @import("std");
const builtin = @import("builtin");
const native_os = builtin.os.tag;

pub const BuildStatus = enum { unknown, pass, fail };

pub const Project = struct {
    name: [128]u8 = undefined,
    name_len: u8 = 0,
    path: [512]u8 = undefined,
    path_len: u16 = 0,
    last_build: BuildStatus = .unknown,
    last_build_time: i64 = 0,

    pub fn getName(self: *const Project) []const u8 {
        return self.name[0..self.name_len];
    }

    pub fn getPath(self: *const Project) []const u8 {
        return self.path[0..self.path_len];
    }

    pub fn setName(self: *Project, s: []const u8) void {
        const n = @min(s.len, self.name.len);
        @memcpy(self.name[0..n], s[0..n]);
        self.name_len = @intCast(n);
    }

    pub fn setPath(self: *Project, s: []const u8) void {
        const n = @min(s.len, self.path.len);
        @memcpy(self.path[0..n], s[0..n]);
        self.path_len = @intCast(n);
    }
};

const MAX_PROJECTS = 64;

pub const Registry = struct {
    projects: [MAX_PROJECTS]Project = undefined,
    count: usize = 0,

    pub fn add(self: *Registry, name: []const u8, path: []const u8) void {
        // Update existing if name matches
        for (0..self.count) |i| {
            if (std.mem.eql(u8, self.projects[i].getName(), name)) {
                self.projects[i].setPath(path);
                return;
            }
        }
        // Add new
        if (self.count >= MAX_PROJECTS) return;
        self.projects[self.count] = .{};
        self.projects[self.count].setName(name);
        self.projects[self.count].setPath(path);
        self.count += 1;
    }

    pub fn remove(self: *Registry, name: []const u8) bool {
        for (0..self.count) |i| {
            if (std.mem.eql(u8, self.projects[i].getName(), name)) {
                // Shift remaining
                if (i + 1 < self.count) {
                    var j = i;
                    while (j + 1 < self.count) : (j += 1) {
                        self.projects[j] = self.projects[j + 1];
                    }
                }
                self.count -= 1;
                return true;
            }
        }
        return false;
    }

    pub fn findByName(self: *Registry, name: []const u8) ?*Project {
        for (0..self.count) |i| {
            if (std.mem.eql(u8, self.projects[i].getName(), name)) {
                return &self.projects[i];
            }
        }
        return null;
    }

    pub fn findByPath(self: *Registry, path: []const u8) ?*Project {
        for (0..self.count) |i| {
            if (std.mem.eql(u8, self.projects[i].getPath(), path)) {
                return &self.projects[i];
            }
        }
        // Also try matching just the filename portion
        const base = std.fs.path.basename(path);
        for (0..self.count) |i| {
            const proj_base = std.fs.path.basename(self.projects[i].getPath());
            if (std.mem.eql(u8, proj_base, base)) {
                return &self.projects[i];
            }
        }
        return null;
    }
};

// ── Config directory ────────────────────────────────────────────────────

var config_dir_buf: [256]u8 = undefined;
var config_dir_len: usize = 0;

pub fn configDir() []const u8 {
    if (config_dir_len > 0) return config_dir_buf[0..config_dir_len];
    if (native_os == .windows) {
        const appdata = std.process.getEnvVarOwned(std.heap.page_allocator, "APPDATA") catch "C:";
        const path = std.fmt.bufPrint(&config_dir_buf, "{s}\\tsz", .{appdata}) catch return "C:\\tsz";
        config_dir_len = path.len;
        return path;
    } else {
        const home = std.posix.getenv("HOME") orelse "/tmp";
        const path = std.fmt.bufPrint(&config_dir_buf, "{s}/.config/tsz", .{home}) catch return "/tmp/.config/tsz";
        config_dir_len = path.len;
        return path;
    }
}

pub fn ensureConfigDir() void {
    const dir = configDir();
    std.fs.cwd().makePath(dir) catch {};
    var pids_buf: [280]u8 = undefined;
    const pids = std.fmt.bufPrint(&pids_buf, "{s}/pids", .{dir}) catch return;
    std.fs.cwd().makePath(pids) catch {};
}

// ── Load / Save ─────────────────────────────────────────────────────────

pub fn load(alloc: std.mem.Allocator) Registry {
    var reg = Registry{};
    var path_buf: [280]u8 = undefined;
    const path = std.fmt.bufPrint(&path_buf, "{s}/projects.json", .{configDir()}) catch return reg;

    const file = std.fs.cwd().openFile(path, .{}) catch return reg;
    defer file.close();

    var buf: [16384]u8 = undefined;
    const len = file.readAll(&buf) catch return reg;
    if (len == 0) return reg;

    const parsed = std.json.parseFromSlice(std.json.Value, alloc, buf[0..len], .{}) catch return reg;
    defer parsed.deinit();

    const root = parsed.value;
    if (root != .object) return reg;

    const projects = root.object.get("projects") orelse return reg;
    if (projects != .array) return reg;

    for (projects.array.items) |item| {
        if (item != .object) continue;
        const name_val = item.object.get("name") orelse continue;
        const path_val = item.object.get("path") orelse continue;
        if (name_val != .string or path_val != .string) continue;

        if (reg.count >= MAX_PROJECTS) break;
        reg.projects[reg.count] = .{};
        reg.projects[reg.count].setName(name_val.string);
        reg.projects[reg.count].setPath(path_val.string);

        if (item.object.get("last_build")) |lb| {
            if (lb == .string) {
                if (std.mem.eql(u8, lb.string, "pass")) {
                    reg.projects[reg.count].last_build = .pass;
                } else if (std.mem.eql(u8, lb.string, "fail")) {
                    reg.projects[reg.count].last_build = .fail;
                }
            }
        }
        if (item.object.get("last_build_time")) |t| {
            if (t == .integer) {
                reg.projects[reg.count].last_build_time = t.integer;
            }
        }
        reg.count += 1;
    }

    return reg;
}

pub fn save(reg: *const Registry) void {
    ensureConfigDir();
    var path_buf: [280]u8 = undefined;
    const path = std.fmt.bufPrint(&path_buf, "{s}/projects.json", .{configDir()}) catch return;

    const file = std.fs.cwd().createFile(path, .{}) catch return;
    defer file.close();

    file.writeAll("{\n  \"projects\": [\n") catch return;

    for (0..reg.count) |i| {
        const p = &reg.projects[i];
        if (i > 0) file.writeAll(",\n") catch return;
        const build_str: []const u8 = switch (p.last_build) {
            .pass => "pass",
            .fail => "fail",
            .unknown => "unknown",
        };
        // Write each field manually to avoid format string issues
        file.writeAll("    { \"name\": \"") catch return;
        file.writeAll(p.getName()) catch return;
        file.writeAll("\", \"path\": \"") catch return;
        file.writeAll(p.getPath()) catch return;
        file.writeAll("\", \"last_build\": \"") catch return;
        file.writeAll(build_str) catch return;
        file.writeAll("\", \"last_build_time\": ") catch return;
        var ts_buf: [20]u8 = undefined;
        const ts_str = std.fmt.bufPrint(&ts_buf, "{d}", .{p.last_build_time}) catch "0";
        file.writeAll(ts_str) catch return;
        file.writeAll(" }") catch return;
    }

    file.writeAll("\n  ]\n}\n") catch return;
}
