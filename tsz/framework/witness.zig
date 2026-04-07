//! Witness — record human-verified interactions, replay to catch regressions.
//!
//! RECORD mode (ZIGOS_WITNESS=record):
//!   Hooks into the engine event loop. On every click that hits an interactive
//!   node, records the semantic target (debug_name / test_id / text) plus a
//!   full state snapshot before and after. On frame 5, captures the node tree
//!   with computed layout. On exit, writes to witnesses/<app>.witness.
//!
//! REPLAY mode (ZIGOS_WITNESS=replay):
//!   Reads the witness file. After layout settles, replays each recorded click
//!   by finding the target node semantically (not by coordinates), clicks via
//!   testdriver, and compares state snapshots. Reports per-action PASS/FAIL.
//!   Exits 0 if all pass, 1 if any fail.
//!
//! Usage:
//!   ZIGOS_WITNESS=record ./app          # record interactions
//!   ZIGOS_WITNESS=replay ./app          # replay and verify

const std = @import("std");
const layout = @import("layout.zig");
const Node = layout.Node;
const state_mod = @import("state.zig");
const testdriver = @import("testdriver.zig");
const query = @import("query.zig");

const MAX_ACTIONS = 256;
const MAX_TREE_NODES = 2048;
const MAX_SLOTS = 64;
const MAX_TEXTS = 512; // max text nodes to track
const NAME_LEN = 128;
const TEXT_LEN = 256;

// ── Types ───────────────────────────────────────────────────────────────

const Mode = enum { off, record, replay };

const SlotSnapshot = struct {
    kind: state_mod.SlotKind = .int,
    int_val: i64 = 0,
    float_val: f64 = 0,
    bool_val: bool = false,
    str_buf: [TEXT_LEN]u8 = undefined,
    str_len: u16 = 0,
};

const StateSnapshot = struct {
    slots: [MAX_SLOTS]SlotSnapshot = undefined,
    count: u16 = 0,
};

const TreeNode = struct {
    depth: u16 = 0,
    name_buf: [NAME_LEN]u8 = undefined,
    name_len: u8 = 0,
    text_buf: [TEXT_LEN]u8 = undefined,
    text_len: u16 = 0,
    x: f32 = 0,
    y: f32 = 0,
    w: f32 = 0,
    h: f32 = 0,
    has_handler: bool = false,
};

const TextEntry = struct {
    buf: [TEXT_LEN]u8 = undefined,
    len: u16 = 0,
};

const TextSnapshot = struct {
    texts: [MAX_TEXTS]TextEntry = undefined,
    count: u16 = 0,
};

const ActionKind = enum { click, scroll };

const Action = struct {
    frame: u32 = 0,
    kind: ActionKind = .click,
    // Target identification (semantic — survives layout changes)
    target_name: [NAME_LEN]u8 = undefined,
    target_name_len: u8 = 0,
    target_text: [TEXT_LEN]u8 = undefined,
    target_text_len: u16 = 0,
    // Scroll data
    scroll_x: f32 = 0,
    scroll_y: f32 = 0,
    mouse_x: f32 = 0,
    mouse_y: f32 = 0,
    // State after this action (both zig slots and visible text)
    state_after: StateSnapshot = .{},
    texts_after: TextSnapshot = .{},
};

// ── Module state ────────────────────────────────────────────────────────

var mode: Mode = .off;
var frame_count: u32 = 0;

// Record state
var actions: [MAX_ACTIONS]Action = undefined;
var action_count: u16 = 0;
var tree_nodes: [MAX_TREE_NODES]TreeNode = undefined;
var tree_node_count: u16 = 0;
var initial_state: StateSnapshot = .{};
var initial_texts: TextSnapshot = .{};
var tree_captured: bool = false;
var recorded_root: ?*Node = null;
var pending_text_snap: bool = false; // defer text snapshot to next frame

// Replay state
var replay_idx: u16 = 0;
var replay_tree: [MAX_TREE_NODES]TreeNode = undefined;
var replay_tree_count: u16 = 0;
var replay_actions: [MAX_ACTIONS]Action = undefined;
var replay_action_count: u16 = 0;
var replay_initial_state: StateSnapshot = .{};
var replay_initial_texts: TextSnapshot = .{};
var replay_started: bool = false;
var replay_passed: u16 = 0;
var replay_failed: u16 = 0;
var replay_settle_frame: u32 = 8;
var replay_waiting_verify: bool = false; // true = next frame should verify, not click
var replay_waiting_settle: bool = false; // true = next frame is a settle frame (scroll)

// File path
var witness_path_buf: [512]u8 = undefined;
var witness_path: ?[]const u8 = null;

// ── Init ────────────────────────────────────────────────────────────────

pub fn init() void {
    const env = std.posix.getenv("ZIGOS_WITNESS") orelse return;

    if (std.mem.eql(u8, env, "record")) {
        mode = .record;
        std.debug.print("[witness] RECORD mode — interactions will be saved\n", .{});
    } else if (std.mem.eql(u8, env, "replay")) {
        mode = .replay;
        std.debug.print("[witness] REPLAY mode — verifying against witness file\n", .{});
    }

    // Witness file path
    if (std.posix.getenv("ZIGOS_WITNESS_FILE")) |p| {
        if (p.len < witness_path_buf.len) {
            @memcpy(witness_path_buf[0..p.len], p);
            witness_path = witness_path_buf[0..p.len];
        }
    }

    if (mode == .replay) {
        loadWitness();
    }
}

pub fn isActive() bool {
    return mode != .off;
}

pub fn isRecording() bool {
    return mode == .record;
}

pub fn isReplaying() bool {
    return mode == .replay;
}

/// Exit code: 0 if recording or all replay checks passed, 1 if any failed.
pub fn exitCode() u8 {
    if (mode == .replay and replay_failed > 0) return 1;
    return 0;
}

// ── State snapshotting ──────────────────────────────────────────────────

fn snapshotState() StateSnapshot {
    var snap: StateSnapshot = .{};
    const count = state_mod.slotCount();
    snap.count = @intCast(@min(count, MAX_SLOTS));
    for (0..snap.count) |i| {
        const kind = state_mod.getSlotKind(i);
        snap.slots[i].kind = kind;
        switch (kind) {
            .int => snap.slots[i].int_val = state_mod.getSlot(i),
            .float => snap.slots[i].float_val = state_mod.getSlotFloat(i),
            .boolean => snap.slots[i].bool_val = state_mod.getSlotBool(i),
            .string => {
                const s = state_mod.getSlotString(i);
                const len = @min(s.len, TEXT_LEN);
                @memcpy(snap.slots[i].str_buf[0..len], s[0..len]);
                snap.slots[i].str_len = @intCast(len);
            },
        }
    }
    return snap;
}

fn statesMatch(a: *const StateSnapshot, b: *const StateSnapshot) bool {
    if (a.count != b.count) return false;
    for (0..a.count) |i| {
        if (a.slots[i].kind != b.slots[i].kind) return false;
        switch (a.slots[i].kind) {
            .int => if (a.slots[i].int_val != b.slots[i].int_val) return false,
            .float => if (@abs(a.slots[i].float_val - b.slots[i].float_val) > 0.001) return false,
            .boolean => if (a.slots[i].bool_val != b.slots[i].bool_val) return false,
            .string => {
                const sa = a.slots[i].str_buf[0..a.slots[i].str_len];
                const sb = b.slots[i].str_buf[0..b.slots[i].str_len];
                if (!std.mem.eql(u8, sa, sb)) return false;
            },
        }
    }
    return true;
}

// ── Tree snapshotting ───────────────────────────────────────────────────

fn snapshotTree(root: *Node) void {
    tree_node_count = 0;
    walkTree(root, 0);
    tree_captured = true;
}

fn walkTree(node: *Node, depth: u16) void {
    if (tree_node_count >= MAX_TREE_NODES) return;
    if (node.style.display == .none) return;

    const idx = tree_node_count;
    tree_node_count += 1;

    tree_nodes[idx] = .{};
    tree_nodes[idx].depth = depth;
    tree_nodes[idx].x = node.computed.x;
    tree_nodes[idx].y = node.computed.y;
    tree_nodes[idx].w = node.computed.w;
    tree_nodes[idx].h = node.computed.h;

    if (node.debug_name) |name| {
        const len = @min(name.len, NAME_LEN);
        @memcpy(tree_nodes[idx].name_buf[0..len], name[0..len]);
        tree_nodes[idx].name_len = @intCast(len);
    }
    if (node.text) |txt| {
        const len = @min(txt.len, TEXT_LEN);
        @memcpy(tree_nodes[idx].text_buf[0..len], txt[0..len]);
        tree_nodes[idx].text_len = @intCast(len);
    }

    const h = node.handlers;
    tree_nodes[idx].has_handler = (h.on_press != null or h.js_on_press != null or h.lua_on_press != null);

    for (node.children) |*child| {
        walkTree(child, depth + 1);
    }
}

// ── Text snapshotting (captures what the user sees) ─────────────────────

fn snapshotTexts(root: *Node) TextSnapshot {
    var snap: TextSnapshot = .{};
    collectTexts(root, &snap);
    return snap;
}

fn collectTexts(node: *Node, snap: *TextSnapshot) void {
    if (node.style.display == .none) return;
    if (snap.count >= MAX_TEXTS) return;

    if (node.text) |txt| {
        if (txt.len > 0) {
            const idx = snap.count;
            snap.count += 1;
            const len = @min(txt.len, TEXT_LEN);
            @memcpy(snap.texts[idx].buf[0..len], txt[0..len]);
            snap.texts[idx].len = @intCast(len);
        }
    }
    for (node.children) |*child| {
        collectTexts(child, snap);
    }
}

fn textsMatch(a: *const TextSnapshot, b: *const TextSnapshot) bool {
    if (a.count != b.count) return false;
    for (0..a.count) |i| {
        const at = a.texts[i].buf[0..a.texts[i].len];
        const bt = b.texts[i].buf[0..b.texts[i].len];
        if (!std.mem.eql(u8, at, bt)) return false;
    }
    return true;
}

fn printTextDiff(before: *const TextSnapshot, after: *const TextSnapshot) bool {
    var any_change = false;
    const max = @max(before.count, after.count);
    for (0..max) |i| {
        if (i >= before.count) {
            const at = after.texts[i].buf[0..after.texts[i].len];
            std.debug.print("  + \"{s}\"\n", .{at});
            any_change = true;
            continue;
        }
        if (i >= after.count) {
            const bt = before.texts[i].buf[0..before.texts[i].len];
            std.debug.print("  - \"{s}\"\n", .{bt});
            any_change = true;
            continue;
        }
        const bt = before.texts[i].buf[0..before.texts[i].len];
        const at = after.texts[i].buf[0..after.texts[i].len];
        if (!std.mem.eql(u8, bt, at)) {
            std.debug.print("  \"{s}\" → \"{s}\"\n", .{ bt, at });
            any_change = true;
        }
    }
    return any_change;
}

// ── Record: click ───────────────────────────────────────────────────────

/// Called from engine.zig after a click hits an interactive node and the
/// handler has run. Records the semantic target + state snapshot.
pub fn recordClick(hit_node: *Node) void {
    if (mode != .record) return;
    if (action_count >= MAX_ACTIONS) return;

    const idx = action_count;
    action_count += 1;

    actions[idx] = .{};
    actions[idx].frame = frame_count;

    // Capture semantic target
    if (hit_node.debug_name) |name| {
        const len = @min(name.len, NAME_LEN);
        @memcpy(actions[idx].target_name[0..len], name[0..len]);
        actions[idx].target_name_len = @intCast(len);
    }
    if (hit_node.text) |txt| {
        const len = @min(txt.len, TEXT_LEN);
        @memcpy(actions[idx].target_text[0..len], txt[0..len]);
        actions[idx].target_text_len = @intCast(len);
    } else {
        // If the pressable itself has no text, check first child (common pattern)
        if (hit_node.children.len > 0) {
            if (hit_node.children[0].text) |txt| {
                const len = @min(txt.len, TEXT_LEN);
                @memcpy(actions[idx].target_text[0..len], txt[0..len]);
                actions[idx].target_text_len = @intCast(len);
            }
        }
    }

    // Zig state slots (immediate — setSlot happens synchronously)
    actions[idx].state_after = snapshotState();
    // Text snapshot is DEFERRED to next frame — tree hasn't rebuilt yet
    pending_text_snap = true;

    // Get previous snapshots for diffing zig state
    const state_before = if (idx > 0) actions[idx - 1].state_after else initial_state;

    const target_name = actions[idx].target_name[0..actions[idx].target_name_len];
    const target_text = actions[idx].target_text[0..actions[idx].target_text_len];
    std.debug.print("[witness] click #{d}: \"{s}\" (frame {d})\n", .{
        idx,
        if (target_text.len > 0) target_text else target_name,
        frame_count,
    });

    // Print zig state slot changes (if any exist)
    const after = &actions[idx].state_after;
    var slot_change = false;
    for (0..after.count) |si| {
        if (si >= state_before.count) break;
        const a = &after.slots[si];
        const b = &state_before.slots[si];
        if (a.kind != b.kind) continue;
        switch (a.kind) {
            .int => {
                if (a.int_val != b.int_val) {
                    std.debug.print("  slot[{d}]: {d} → {d}\n", .{ si, b.int_val, a.int_val });
                    slot_change = true;
                }
            },
            .float => {
                if (@abs(a.float_val - b.float_val) > 0.001) {
                    std.debug.print("  slot[{d}]: {d:.2} → {d:.2}\n", .{ si, b.float_val, a.float_val });
                    slot_change = true;
                }
            },
            .boolean => {
                if (a.bool_val != b.bool_val) {
                    std.debug.print("  slot[{d}]: {} → {}\n", .{ si, b.bool_val, a.bool_val });
                    slot_change = true;
                }
            },
            .string => {
                const sa = a.str_buf[0..a.str_len];
                const sb = b.str_buf[0..b.str_len];
                if (!std.mem.eql(u8, sa, sb)) {
                    std.debug.print("  slot[{d}]: \"{s}\" → \"{s}\"\n", .{ si, sb, sa });
                    slot_change = true;
                }
            },
        }
    }
    if (!slot_change) {
        std.debug.print("  (text diff next frame)\n", .{});
    }
}

// ── Record: scroll ──────────────────────────────────────────────────────

/// Called from engine.zig on mouse wheel events.
pub fn recordScroll(mx: f32, my: f32, wx: f32, wy: f32) void {
    if (mode != .record) return;
    if (action_count >= MAX_ACTIONS) return;

    const idx = action_count;
    action_count += 1;

    actions[idx] = .{};
    actions[idx].frame = frame_count;
    actions[idx].kind = .scroll;
    actions[idx].mouse_x = mx;
    actions[idx].mouse_y = my;
    actions[idx].scroll_x = wx;
    actions[idx].scroll_y = wy;

    std.debug.print("[witness] scroll @ ({d:.0},{d:.0}) delta=({d:.1},{d:.1}) frame={d}\n", .{
        mx, my, wx, wy, frame_count,
    });

    // Scroll doesn't change state, so no text snapshot needed immediately.
    // The next click's text snapshot will capture the scrolled view.
}

// ── Tick — called every frame from engine ────────────────────────────────

/// Returns true if the app should exit (replay complete).
pub fn tick(root: *Node) bool {
    frame_count += 1;

    if (mode == .record) {
        // Capture initial tree + state on frame 5 (after layout settles)
        if (frame_count == 5 and !tree_captured) {
            recorded_root = root;
            snapshotTree(root);
            initial_state = snapshotState();
            initial_texts = snapshotTexts(root);
            std.debug.print("\n\xe2\x95\x90\xe2\x95\x90 WITNESS RECORDING \xe2\x95\x90\xe2\x95\x90\n\n", .{});
            std.debug.print("  {d} nodes, {d} state slots\n\n", .{
                tree_node_count, initial_state.count,
            });
            // Print the full tree
            for (0..tree_node_count) |i| {
                const tn = &tree_nodes[i];
                const name = tn.name_buf[0..tn.name_len];
                const txt = tn.text_buf[0..tn.text_len];
                // Indent by depth
                var pad: [64]u8 = undefined;
                const pad_len = @min(tn.depth * 2, 62);
                for (0..pad_len) |pi| pad[pi] = ' ';
                const vis: []const u8 = if (tn.w <= 0 or tn.h <= 0) " !! ZERO" else "";
                if (txt.len > 0) {
                    std.debug.print("  {s}{s}  {d:.0}x{d:.0} @ ({d:.0},{d:.0}){s}  \"{s}\"\n", .{
                        pad[0..pad_len], if (name.len > 0) name else "?",
                        tn.w, tn.h, tn.x, tn.y, vis, txt,
                    });
                } else {
                    std.debug.print("  {s}{s}  {d:.0}x{d:.0} @ ({d:.0},{d:.0}){s}{s}\n", .{
                        pad[0..pad_len], if (name.len > 0) name else "?",
                        tn.w, tn.h, tn.x, tn.y, vis,
                        if (tn.has_handler) " [pressable]" else "",
                    });
                }
            }
            // Print initial state
            if (initial_state.count > 0) {
                std.debug.print("\n  State:\n", .{});
                for (0..initial_state.count) |i| {
                    const s = &initial_state.slots[i];
                    switch (s.kind) {
                        .int => std.debug.print("    slot[{d}]: {d}\n", .{ i, s.int_val }),
                        .float => std.debug.print("    slot[{d}]: {d:.2}\n", .{ i, s.float_val }),
                        .boolean => std.debug.print("    slot[{d}]: {}\n", .{ i, s.bool_val }),
                        .string => std.debug.print("    slot[{d}]: \"{s}\"\n", .{ i, s.str_buf[0..s.str_len] }),
                    }
                }
            }
            std.debug.print("\n  Interact with the app. Close window to save.\n\n", .{});
        }

        // Deferred text snapshot: capture text on the frame AFTER a click
        // (tree rebuilds between frames, so text reflects the new state now)
        if (pending_text_snap and action_count > 0) {
            pending_text_snap = false;
            const idx = action_count - 1;
            actions[idx].texts_after = snapshotTexts(root);

            // Print text diff
            const texts_before = if (idx > 0) &actions[idx - 1].texts_after else &initial_texts;
            const text_changed = printTextDiff(texts_before, &actions[idx].texts_after);
            if (!text_changed) {
                std.debug.print("  (no visible change)\n", .{});
            }
        }

        return false;
    }

    if (mode == .replay) {
        return replayTick(root);
    }

    return false;
}

// ── Replay logic ────────────────────────────────────────────────────────

fn replayTick(root: *Node) bool {
    // Wait for layout to settle
    if (frame_count < replay_settle_frame) return false;

    // On settle frame: verify initial state and print what we're checking
    if (!replay_started) {
        replay_started = true;
        std.debug.print("\n\xe2\x95\x90\xe2\x95\x90 WITNESS REPLAY \xe2\x95\x90\xe2\x95\x90\n\n", .{});
        std.debug.print("  {d} tree nodes, {d} text strings, {d} actions to replay\n\n", .{
            replay_tree_count, replay_initial_texts.count, replay_action_count,
        });

        // Show and verify initial visible text
        if (replay_initial_texts.count > 0) {
            const current_texts = snapshotTexts(root);
            std.debug.print("  ── Initial text ──\n", .{});
            for (0..replay_initial_texts.count) |i| {
                const expected = replay_initial_texts.texts[i].buf[0..replay_initial_texts.texts[i].len];
                if (i < current_texts.count) {
                    const actual = current_texts.texts[i].buf[0..current_texts.texts[i].len];
                    if (std.mem.eql(u8, expected, actual)) {
                        std.debug.print("    \xe2\x9c\x93 \"{s}\"\n", .{actual});
                    } else {
                        std.debug.print("    \xe2\x9c\x97 expected \"{s}\", got \"{s}\"\n", .{ expected, actual });
                    }
                } else {
                    std.debug.print("    \xe2\x9c\x97 expected \"{s}\", MISSING\n", .{expected});
                }
            }
            if (textsMatch(&replay_initial_texts, &current_texts)) {
                std.debug.print("  initial text ... PASS\n\n", .{});
                replay_passed += 1;
            } else {
                std.debug.print("  initial text ... FAIL\n\n", .{});
                replay_failed += 1;
            }
        }

        // Verify tree node count
        var live_count: u16 = 0;
        countLiveNodes(root, &live_count);
        if (replay_tree_count > 0) {
            const diff = if (live_count > replay_tree_count) live_count - replay_tree_count else replay_tree_count - live_count;
            if (diff <= 2) {
                std.debug.print("  tree structure ({d} nodes) ... PASS\n", .{live_count});
                replay_passed += 1;
            } else {
                std.debug.print("  tree structure ... FAIL (expected {d} nodes, got {d})\n", .{ replay_tree_count, live_count });
                replay_failed += 1;
            }
        }

        // Verify initial zig state slots (if any)
        if (replay_initial_state.count > 0) {
            const current = snapshotState();
            if (statesMatch(&replay_initial_state, &current)) {
                std.debug.print("  initial state ({d} slots) ... PASS\n", .{replay_initial_state.count});
                replay_passed += 1;
            } else {
                std.debug.print("  initial state ... FAIL\n", .{});
                printStateDiff(&replay_initial_state, &current);
                replay_failed += 1;
            }
        }

        if (replay_action_count == 0) {
            return finishReplay();
        }
        std.debug.print("\n  ── Replaying {d} clicks ──\n", .{replay_action_count});
    }

    // Verify frame: check text from PREVIOUS click (one frame delay for tree rebuild)
    if (replay_waiting_verify and replay_idx > 0) {
        replay_waiting_verify = false;
        const prev = &replay_actions[replay_idx - 1];
        if (prev.texts_after.count > 0) {
            const current_texts = snapshotTexts(root);
            if (textsMatch(&prev.texts_after, &current_texts)) {
                std.debug.print(" ... PASS\n", .{});
                replay_passed += 1;
            } else {
                std.debug.print(" ... FAIL\n", .{});
                _ = printTextDiff(&prev.texts_after, &current_texts);
                replay_failed += 1;
            }
        } else {
            std.debug.print(" ... PASS (no text baseline)\n", .{});
            replay_passed += 1;
        }

        // If that was the last action, we're done
        if (replay_idx >= replay_action_count) {
            return finishReplay();
        }
    }

    // Wait for scroll to settle (SDL event queue needs a frame to process)
    if (replay_waiting_settle) {
        replay_waiting_settle = false;
        return false;
    }

    // Execute next action
    if (replay_idx < replay_action_count and !replay_waiting_verify) {
        const action = &replay_actions[replay_idx];

        if (action.kind == .scroll) {
            // Scroll: send wheel event with mouse position
            testdriver.scrollAt(action.scroll_x, action.scroll_y, action.mouse_x, action.mouse_y);
            std.debug.print("  [{d}/{d}] scroll ({d:.1},{d:.1}) @ ({d:.0},{d:.0})\n", .{
                replay_idx + 1, replay_action_count,
                action.scroll_x, action.scroll_y, action.mouse_x, action.mouse_y,
            });
            replay_idx += 1;
            replay_waiting_settle = true; // wait 1 frame for SDL to process
            return false;
        }

        // Click action
        const target_name = action.target_name[0..action.target_name_len];
        const target_text = action.target_text[0..action.target_text_len];
        const label = if (target_text.len > 0) target_text else target_name;

        // Find and click the target node
        var clicked = false;
        if (target_name.len > 0) {
            clicked = testdriver.clickNode(root, .{ .debug_name = target_name });
        }
        if (!clicked and target_text.len > 0) {
            clicked = testdriver.clickNode(root, .{ .text_contains = target_text, .has_handler = true });
        }
        if (!clicked and target_text.len > 0) {
            if (query.findByText(root, target_text)) |result| {
                testdriver.click(result.cx, result.cy);
                clicked = true;
            }
        }

        std.debug.print("  [{d}/{d}] click \"{s}\"", .{ replay_idx + 1, replay_action_count, label });
        if (!clicked) {
            std.debug.print(" ... FAIL (node not found)\n", .{});
            replay_failed += 1;
        }

        replay_idx += 1;
        replay_waiting_verify = true; // verify on next frame
    }

    return false;
}

fn countLiveNodes(node: *Node, count: *u16) void {
    if (node.style.display == .none) return;
    count.* += 1;
    for (node.children) |*child| {
        countLiveNodes(child, count);
    }
}

fn finishReplay() bool {
    const total = replay_passed + replay_failed;
    std.debug.print("\n\xe2\x95\x90\xe2\x95\x90 WITNESS RESULT: {d}/{d} passed \xe2\x95\x90\xe2\x95\x90\n\n", .{ replay_passed, total });
    return true; // signal engine to exit
}

fn printStateDiff(expected: *const StateSnapshot, actual: *const StateSnapshot) void {
    const max = @max(expected.count, actual.count);
    for (0..max) |i| {
        if (i >= expected.count or i >= actual.count) {
            std.debug.print("    slot[{d}]: count mismatch\n", .{i});
            continue;
        }
        const e = &expected.slots[i];
        const a = &actual.slots[i];
        if (e.kind != a.kind) {
            std.debug.print("    slot[{d}]: kind mismatch\n", .{i});
            continue;
        }
        switch (e.kind) {
            .int => {
                if (e.int_val != a.int_val)
                    std.debug.print("    slot[{d}]: expected {d}, got {d}\n", .{ i, e.int_val, a.int_val });
            },
            .float => {
                if (@abs(e.float_val - a.float_val) > 0.001)
                    std.debug.print("    slot[{d}]: expected {d:.3}, got {d:.3}\n", .{ i, e.float_val, a.float_val });
            },
            .boolean => {
                if (e.bool_val != a.bool_val)
                    std.debug.print("    slot[{d}]: expected {}, got {}\n", .{ i, e.bool_val, a.bool_val });
            },
            .string => {
                const es = e.str_buf[0..e.str_len];
                const as = a.str_buf[0..a.str_len];
                if (!std.mem.eql(u8, es, as))
                    std.debug.print("    slot[{d}]: expected \"{s}\", got \"{s}\"\n", .{ i, es, as });
            },
        }
    }
}

// ── File I/O ────────────────────────────────────────────────────────────

/// Write the witness recording to disk.
pub fn flush() void {
    if (mode != .record) return;
    if (!tree_captured and action_count == 0) return;

    const path = witness_path orelse {
        std.debug.print("[witness] no ZIGOS_WITNESS_FILE set, cannot save\n", .{});
        return;
    };

    const file = std.fs.cwd().createFile(path, .{ .truncate = true }) catch |err| {
        std.debug.print("[witness] cannot create {s}: {}\n", .{ path, err });
        return;
    };
    defer file.close();

    var buf: [4096]u8 = undefined;

    // Header
    emit(file, &buf, "WITNESS v1\n", .{});
    emit(file, &buf, "SLOTS {d}\n", .{initial_state.count});

    // Initial state (zig slots)
    emit(file, &buf, "STATE_INIT\n", .{});
    writeStateToFile(file, &buf, &initial_state);
    emit(file, &buf, "END\n", .{});

    // Initial visible text
    emit(file, &buf, "TEXTS_INIT {d}\n", .{initial_texts.count});
    writeTextsToFile(file, &buf, &initial_texts);
    emit(file, &buf, "END\n", .{});

    // Tree
    if (tree_captured) {
        emit(file, &buf, "TREE {d}\n", .{tree_node_count});
        for (0..tree_node_count) |i| {
            const tn = &tree_nodes[i];
            const name = tn.name_buf[0..tn.name_len];
            const txt = tn.text_buf[0..tn.text_len];
            emit(file, &buf, "N {d} {d:.0} {d:.0} {d:.0} {d:.0} {d} {d}:{s} {d}:{s}\n", .{
                tn.depth, tn.x, tn.y, tn.w, tn.h,
                @as(u8, if (tn.has_handler) 1 else 0),
                name.len, name, txt.len, txt,
            });
        }
        emit(file, &buf, "END\n", .{});
    }

    // Actions
    for (0..action_count) |i| {
        const a = &actions[i];
        switch (a.kind) {
            .click => {
                const aname = a.target_name[0..a.target_name_len];
                const atxt = a.target_text[0..a.target_text_len];
                emit(file, &buf, "CLICK {d} {d}:{s} {d}:{s}\n", .{
                    a.frame, aname.len, aname, atxt.len, atxt,
                });
                emit(file, &buf, "STATE_AFTER\n", .{});
                writeStateToFile(file, &buf, &a.state_after);
                emit(file, &buf, "END\n", .{});
                emit(file, &buf, "TEXTS_AFTER {d}\n", .{a.texts_after.count});
                writeTextsToFile(file, &buf, &a.texts_after);
                emit(file, &buf, "END\n", .{});
            },
            .scroll => {
                emit(file, &buf, "SCROLL {d} {d:.1} {d:.1} {d:.0} {d:.0}\n", .{
                    a.frame, a.scroll_x, a.scroll_y, a.mouse_x, a.mouse_y,
                });
            },
        }
    }

    emit(file, &buf, "DONE\n", .{});

    std.debug.print("[witness] saved {d} tree nodes + {d} actions to {s}\n", .{
        tree_node_count, action_count, path,
    });
}

fn emit(file: std.fs.File, buf: []u8, comptime fmt: []const u8, args: anytype) void {
    const s = std.fmt.bufPrint(buf, fmt, args) catch return;
    _ = file.write(s) catch {};
}

fn writeTextsToFile(file: std.fs.File, buf: []u8, snap: *const TextSnapshot) void {
    for (0..snap.count) |i| {
        const t = &snap.texts[i];
        const tv = t.buf[0..t.len];
        emit(file, buf, "T {d}:{s}\n", .{ tv.len, tv });
    }
}

fn writeStateToFile(file: std.fs.File, buf: []u8, snap: *const StateSnapshot) void {
    for (0..snap.count) |i| {
        const s = &snap.slots[i];
        switch (s.kind) {
            .int => emit(file, buf, "I {d}\n", .{s.int_val}),
            .float => emit(file, buf, "F {d:.6}\n", .{s.float_val}),
            .boolean => emit(file, buf, "B {d}\n", .{@as(u8, if (s.bool_val) 1 else 0)}),
            .string => {
                const sv = s.str_buf[0..s.str_len];
                emit(file, buf, "S {d}:{s}\n", .{ sv.len, sv });
            },
        }
    }
}

// ── Load witness file for replay ────────────────────────────────────────

fn loadWitness() void {
    const path = witness_path orelse {
        std.debug.print("[witness] no ZIGOS_WITNESS_FILE set for replay\n", .{});
        mode = .off;
        return;
    };

    const data = std.fs.cwd().readFileAlloc(std.heap.page_allocator, path, 4 * 1024 * 1024) catch |err| {
        std.debug.print("[witness] cannot read {s}: {}\n", .{ path, err });
        mode = .off;
        return;
    };

    var lines = std.mem.splitScalar(u8, data, '\n');
    var in_state_init = false;
    var in_state_after = false;
    var in_tree = false;
    var in_texts_init = false;
    var in_texts_after = false;
    var state_slot_idx: u16 = 0;
    var current_action: ?*Action = null;
    var action_state_idx: u16 = 0;
    var texts_idx: u16 = 0;

    while (lines.next()) |line| {
        if (line.len == 0) continue;

        if (std.mem.eql(u8, line, "END")) {
            if (in_texts_init) {
                replay_initial_texts.count = texts_idx;
            }
            if (in_texts_after) {
                if (current_action) |a| {
                    a.texts_after.count = texts_idx;
                }
                // TEXTS_AFTER is the last section per action — clear current_action
                current_action = null;
            }
            if (in_state_after) {
                if (current_action) |a| {
                    a.state_after.count = action_state_idx;
                }
                // Don't clear current_action here — TEXTS_AFTER still needs it
            }
            in_state_init = false;
            in_state_after = false;
            in_tree = false;
            in_texts_init = false;
            in_texts_after = false;
            continue;
        }

        if (std.mem.eql(u8, line, "STATE_INIT")) {
            in_state_init = true;
            state_slot_idx = 0;
            continue;
        }

        if (std.mem.eql(u8, line, "STATE_AFTER")) {
            in_state_after = true;
            action_state_idx = 0;
            continue;
        }

        if (std.mem.startsWith(u8, line, "TEXTS_INIT ")) {
            in_texts_init = true;
            texts_idx = 0;
            continue;
        }

        if (std.mem.startsWith(u8, line, "TEXTS_AFTER ")) {
            in_texts_after = true;
            texts_idx = 0;
            continue;
        }

        if (std.mem.startsWith(u8, line, "TREE ")) {
            in_tree = true;
            replay_tree_count = 0;
            continue;
        }

        // Parse text lines (T <len>:<data>)
        if (in_texts_init or in_texts_after) {
            if (line[0] == 'T' and line.len > 2) {
                const snap = if (in_texts_init) &replay_initial_texts else if (current_action) |a| &a.texts_after else continue;
                if (texts_idx >= MAX_TEXTS) continue;
                const rest = line[2..];
                if (std.mem.indexOfScalar(u8, rest, ':')) |colon| {
                    const tlen = std.fmt.parseInt(u16, rest[0..colon], 10) catch 0;
                    const tdata = rest[colon + 1 ..];
                    const copy_len = @min(tlen, @as(u16, @intCast(@min(tdata.len, TEXT_LEN))));
                    @memcpy(snap.texts[texts_idx].buf[0..copy_len], tdata[0..copy_len]);
                    snap.texts[texts_idx].len = copy_len;
                    texts_idx += 1;
                }
            }
            continue;
        }

        // Parse state lines (I/F/B/S)
        if (in_state_init or in_state_after) {
            const snap = if (in_state_init) &replay_initial_state else if (current_action) |a| &a.state_after else continue;
            const idx = if (in_state_init) state_slot_idx else action_state_idx;

            if (idx >= MAX_SLOTS) continue;

            if (line[0] == 'I' and line.len > 2) {
                snap.slots[idx].kind = .int;
                snap.slots[idx].int_val = std.fmt.parseInt(i64, std.mem.trim(u8, line[2..], " "), 10) catch 0;
            } else if (line[0] == 'F' and line.len > 2) {
                snap.slots[idx].kind = .float;
                snap.slots[idx].float_val = std.fmt.parseFloat(f64, std.mem.trim(u8, line[2..], " ")) catch 0;
            } else if (line[0] == 'B' and line.len > 2) {
                snap.slots[idx].kind = .boolean;
                snap.slots[idx].bool_val = line[2] == '1';
            } else if (line[0] == 'S' and line.len > 2) {
                snap.slots[idx].kind = .string;
                // Parse "S <len>:<data>"
                const rest = line[2..];
                if (std.mem.indexOfScalar(u8, rest, ':')) |colon| {
                    const slen = std.fmt.parseInt(u16, rest[0..colon], 10) catch 0;
                    const sdata = rest[colon + 1 ..];
                    const copy_len = @min(slen, @as(u16, @intCast(@min(sdata.len, TEXT_LEN))));
                    @memcpy(snap.slots[idx].str_buf[0..copy_len], sdata[0..copy_len]);
                    snap.slots[idx].str_len = copy_len;
                }
            }

            if (in_state_init) {
                state_slot_idx += 1;
                replay_initial_state.count = state_slot_idx;
            } else {
                action_state_idx += 1;
            }
            continue;
        }

        // Parse tree nodes
        if (in_tree) {
            if (line[0] == 'N' and line.len > 2) {
                if (replay_tree_count >= MAX_TREE_NODES) continue;
                // Minimal parse — just count for now
                replay_tree_count += 1;
            }
            continue;
        }

        // Parse CLICK lines
        if (std.mem.startsWith(u8, line, "CLICK ")) {
            if (replay_action_count >= MAX_ACTIONS) continue;
            const idx = replay_action_count;
            replay_action_count += 1;
            replay_actions[idx] = .{};
            current_action = &replay_actions[idx];

            // Parse "CLICK <frame> <name_len>:<name> <text_len>:<text>"
            const rest = line[6..];
            var parts = std.mem.splitScalar(u8, rest, ' ');
            if (parts.next()) |frame_str| {
                replay_actions[idx].frame = std.fmt.parseInt(u32, frame_str, 10) catch 0;
            }
            // Parse name
            if (parts.next()) |name_part| {
                if (std.mem.indexOfScalar(u8, name_part, ':')) |colon| {
                    const nlen = std.fmt.parseInt(u8, name_part[0..colon], 10) catch 0;
                    if (nlen > 0) {
                        // Name might contain spaces, so reconstruct from remaining
                        const name_start = name_part[colon + 1 ..];
                        const copy_len = @min(nlen, @as(u8, @intCast(@min(name_start.len, NAME_LEN))));
                        @memcpy(replay_actions[idx].target_name[0..copy_len], name_start[0..copy_len]);
                        replay_actions[idx].target_name_len = copy_len;
                    }
                }
            }
            // Parse text — rest of line after second length-prefixed field
            if (parts.next()) |text_part| {
                if (std.mem.indexOfScalar(u8, text_part, ':')) |colon| {
                    const tlen = std.fmt.parseInt(u16, text_part[0..colon], 10) catch 0;
                    if (tlen > 0) {
                        const text_start = text_part[colon + 1 ..];
                        const copy_len = @min(tlen, @as(u16, @intCast(@min(text_start.len, TEXT_LEN))));
                        @memcpy(replay_actions[idx].target_text[0..copy_len], text_start[0..copy_len]);
                        replay_actions[idx].target_text_len = copy_len;
                    }
                }
            }
            continue;
        }

        // Parse SCROLL lines: "SCROLL <frame> <sx> <sy> <mx> <my>"
        if (std.mem.startsWith(u8, line, "SCROLL ")) {
            if (replay_action_count >= MAX_ACTIONS) continue;
            const idx = replay_action_count;
            replay_action_count += 1;
            replay_actions[idx] = .{};
            replay_actions[idx].kind = .scroll;

            const rest = line[7..];
            var parts = std.mem.splitScalar(u8, rest, ' ');
            if (parts.next()) |f| replay_actions[idx].frame = std.fmt.parseInt(u32, f, 10) catch 0;
            if (parts.next()) |v| replay_actions[idx].scroll_x = std.fmt.parseFloat(f32, v) catch 0;
            if (parts.next()) |v| replay_actions[idx].scroll_y = std.fmt.parseFloat(f32, v) catch 0;
            if (parts.next()) |v| replay_actions[idx].mouse_x = std.fmt.parseFloat(f32, v) catch 0;
            if (parts.next()) |v| replay_actions[idx].mouse_y = std.fmt.parseFloat(f32, v) catch 0;
            continue;
        }

        // SLOTS line
        if (std.mem.startsWith(u8, line, "SLOTS ")) continue; // informational
        if (std.mem.eql(u8, line, "DONE")) break;
    }

    std.debug.print("[witness] loaded: {d} tree nodes, {d} actions, {d} state slots\n", .{
        replay_tree_count, replay_action_count, replay_initial_state.count,
    });
}
