//! classifier.zig — Row classification for semantic terminal rendering
//!
//! Ports of love2d/lua/classifiers/basic.lua (82 lines) and
//! love2d/lua/classifiers/claude_code.lua (250 lines).
//! Pattern-matches terminal row text to assign semantic token kinds.

const std = @import("std");

// ── Token kinds ─────────────────────────────────────────────────────

pub const TokenKind = enum(u8) {
    // Basic shell tokens (basic.lua)
    command,
    output,
    err,
    success,
    heading,
    separator,
    progress,

    // Claude Code tokens (claude_code.lua)
    user_prompt,
    user_text,
    user_input,
    thinking,
    thought_complete,
    assistant_text,
    tool,
    result,
    diff,
    error_text,
    banner,
    status_bar,
    idle_prompt,
    input_border,
    input_zone,
    box_drawing,
    menu_title,
    menu_option,
    menu_desc,
    list_selectable,
    list_selected,
    list_info,
    search_box,
    selector,
    confirmation,
    hint,
    picker_title,
    picker_item,
    picker_selected,
    picker_meta,
    permission,
    plan_border,
    plan_mode,
    wizard_step,
    task_summary,
    task_done,
    task_open,
    task_active,
    slash_menu,
    image_attachment,

    // Fallback
    plain,
};

// ── UTF-8 byte sequences for Unicode chars ──────────────────────────

const UTF8_CHEVRON = "\xe2\x9d\xaf"; // ❯ U+276F
const UTF8_BULLET = "\xe2\x97\x8f"; // ● U+25CF
const UTF8_BULLET_SM = "\xe2\x80\xa2"; // • U+2022
const UTF8_DIAMOND = "\xe2\x97\x86"; // ◆ U+25C6
const UTF8_CHECK = "\xe2\x9c\x94"; // ✔ U+2714
const UTF8_OPEN_BOX = "\xe2\x97\xbb"; // ◻ U+25FB
const UTF8_ELLIPSIS = "\xe2\x80\xa6"; // … U+2026
const UTF8_SPARKLE = "\xe2\x9c\xbb"; // ✻ U+273B
const UTF8_RESULT = "\xe2\x8e\xbf"; // ⎿ U+23BF
const UTF8_BOX_H = "\xe2\x94\x80"; // ─ U+2500
const UTF8_BOX_V = "\xe2\x94\x82"; // │ U+2502
const UTF8_BOX_TL = "\xe2\x94\x8c"; // ┌ U+250C
const UTF8_BOX_BL = "\xe2\x94\x94"; // └ U+2514
const UTF8_ROUND_TL = "\xe2\x95\xad"; // ╭ U+256D
const UTF8_ROUND_BL = "\xe2\x95\xb0"; // ╰ U+2570
const UTF8_DASHED_H = "\xe2\x95\x8c"; // ╌ U+254C
const UTF8_MIDDOT = "\xc2\xb7"; // · U+00B7
const UTF8_ARROW_DOWN = "\xe2\x86\x93"; // ↓ U+2193
const UTF8_ARROW_LEFT = "\xe2\x86\x90"; // ← U+2190
const UTF8_ARROW_RIGHT = "\xe2\x86\x92"; // → U+2192
const UTF8_CROSS = "\xe2\x9c\x97"; // ✗ U+2717
const UTF8_HEAVY_CROSS = "\xe2\x9c\x98"; // ✘ U+2718
const UTF8_CHECK_MARK = "\xe2\x9c\x93"; // ✓ U+2713
const UTF8_SQUARE = "\xe2\x96\xa1"; // □ U+25A1
const UTF8_NBSP = "\xc2\xa0"; // NBSP U+00A0

// ── Helpers ─────────────────────────────────────────────────────────

fn contains(haystack: []const u8, needle: []const u8) bool {
    return std.mem.indexOf(u8, haystack, needle) != null;
}

fn startsWith(haystack: []const u8, needle: []const u8) bool {
    return std.mem.startsWith(u8, haystack, needle);
}

fn trim(text: []const u8) []const u8 {
    return std.mem.trim(u8, text, " \t");
}

/// Check if text matches a digit pattern like "N. " (numbered menu item)
fn hasNumberedPrefix(text: []const u8) bool {
    const t = trim(text);
    var i: usize = 0;
    // Skip optional > prefix
    if (i < t.len and t[i] == '>') i += 1;
    // Skip spaces
    while (i < t.len and t[i] == ' ') i += 1;
    // Need at least one digit
    if (i >= t.len or t[i] < '0' or t[i] > '9') return false;
    while (i < t.len and t[i] >= '0' and t[i] <= '9') i += 1;
    // Then a dot and space
    if (i + 1 < t.len and t[i] == '.' and t[i + 1] == ' ') return true;
    return false;
}

/// Check if text contains a digit followed by "%" (progress indicator)
fn hasPercentage(text: []const u8) bool {
    var i: usize = 0;
    while (i < text.len) : (i += 1) {
        if (text[i] >= '0' and text[i] <= '9') {
            // Skip rest of digits
            while (i + 1 < text.len and text[i + 1] >= '0' and text[i + 1] <= '9') i += 1;
            if (i + 1 < text.len and text[i + 1] == '%') return true;
        }
    }
    return false;
}

/// Check if text has "N tokens" pattern
fn hasTokenCount(text: []const u8) bool {
    if (std.mem.indexOf(u8, text, "tokens")) |pos| {
        // Check for digits before "tokens"
        if (pos > 0) {
            var i = pos - 1;
            while (i > 0 and text[i] == ' ') i -= 1;
            if (text[i] >= '0' and text[i] <= '9') return true;
        }
    }
    return false;
}

/// Check if text starts with $ + space + content (shell prompt)
fn isDollarPrompt(text: []const u8) bool {
    const t = trim(text);
    if (t.len >= 3 and t[0] == '$' and t[1] == ' ' and t[2] != ' ') return true;
    return false;
}

/// Check if text starts with > + space + content
fn isAnglePrompt(text: []const u8) bool {
    const t = trim(text);
    if (t.len >= 3 and t[0] == '>' and t[1] == ' ' and t[2] != ' ') return true;
    return false;
}

/// Check if line is entirely box-drawing or separator chars
fn isSeparatorLine(text: []const u8) bool {
    const t = trim(text);
    if (t.len == 0) return false;
    var i: usize = 0;
    while (i < t.len) {
        const b = t[i];
        // ASCII separators: - = ~ * _
        if (b == '-' or b == '=' or b == '~' or b == '*' or b == '_') {
            i += 1;
            continue;
        }
        // UTF-8 box/separator chars (3-byte sequences starting with 0xE2)
        if (b == 0xE2 and i + 2 < t.len) {
            // Check for known box-drawing ranges
            const b1 = t[i + 1];
            const b2 = t[i + 2];
            // ─ ═ ╌ ╍ ┄ ┅ ┈ ┉ and box corners/intersections
            if (b1 == 0x94 or b1 == 0x95 or b1 == 0x94) {
                _ = b2; // All box-drawing chars in these ranges
                i += 3;
                continue;
            }
            return false;
        }
        return false;
    }
    return true;
}

/// Check for user@host:path$ prompt pattern
fn isUserHostPrompt(text: []const u8) bool {
    // Look for @ followed later by $ or #
    const at_pos = std.mem.indexOf(u8, text, "@") orelse return false;
    // Must have text before @
    if (at_pos == 0) return false;
    // Look for : or ~ after @
    const after_at = text[at_pos + 1 ..];
    if (std.mem.indexOf(u8, after_at, ":") != null or
        std.mem.indexOf(u8, after_at, "~") != null)
    {
        // Look for $ or # followed by space
        if (std.mem.indexOf(u8, after_at, "$ ") != null or
            std.mem.indexOf(u8, after_at, "# ") != null)
        {
            return true;
        }
    }
    return false;
}

/// Check if trimmed text is all uppercase (for heading detection)
fn isAllCaps(text: []const u8) bool {
    if (text.len == 0 or text.len >= 60) return false;
    var has_letter = false;
    for (text) |ch| {
        if (ch >= 'a' and ch <= 'z') return false;
        if (ch >= 'A' and ch <= 'Z') has_letter = true;
    }
    return has_letter;
}

/// Check if text has bullet followed by function call pattern: word(
fn hasBulletFuncCall(text: []const u8) bool {
    // Look for ● , • , or ◆ followed by space and word(
    const bullets = [_][]const u8{ UTF8_BULLET, UTF8_BULLET_SM, UTF8_DIAMOND };
    for (bullets) |bullet| {
        if (std.mem.indexOf(u8, text, bullet)) |pos| {
            const after = text[pos + bullet.len ..];
            // Skip spaces
            var i: usize = 0;
            while (i < after.len and after[i] == ' ') i += 1;
            // Look for word(
            while (i < after.len and ((after[i] >= 'a' and after[i] <= 'z') or
                (after[i] >= 'A' and after[i] <= 'Z') or after[i] == '_'))
            {
                i += 1;
            }
            if (i > 0 and i < after.len and after[i] == '(') return true;
        }
    }
    return false;
}

/// Get text after chevron (❯), skipping NBSP
fn textAfterChevron(text: []const u8) ?[]const u8 {
    const pos = std.mem.indexOf(u8, text, UTF8_CHEVRON) orelse return null;
    var rest = text[pos + UTF8_CHEVRON.len ..];
    // Skip NBSP
    if (startsWith(rest, UTF8_NBSP)) rest = rest[UTF8_NBSP.len..];
    // Skip spaces
    rest = std.mem.trimLeft(u8, rest, " ");
    if (rest.len > 0) return rest;
    return null;
}

// ── Basic classifier ────────────────────────────────────────────────
// Port of love2d/lua/classifiers/basic.lua

pub fn classifyBasic(text: []const u8, row: u16, _: u16) TokenKind {
    const stripped = trim(text);
    if (stripped.len == 0) return .output;

    // Separator lines
    if (isSeparatorLine(stripped)) return .separator;

    // Error patterns
    if (startsWith(stripped, "Error:") or startsWith(stripped, "Error[") or
        startsWith(stripped, "error:") or startsWith(stripped, "error[")) return .err;
    if (startsWith(stripped, "Failed") or startsWith(stripped, "failed")) return .err;
    if (startsWith(stripped, "FAIL")) return .err;
    if (startsWith(stripped, "panic:")) return .err;
    if (startsWith(stripped, "fatal:")) return .err;
    if (startsWith(stripped, "Exception:") or startsWith(stripped, "exception:")) return .err;
    if (startsWith(stripped, UTF8_CROSS) or startsWith(stripped, UTF8_HEAVY_CROSS)) return .err;

    // Success patterns
    if (startsWith(stripped, "Done") or startsWith(stripped, "done")) return .success;
    if (startsWith(stripped, "OK")) return .success;
    if (startsWith(stripped, "PASS")) return .success;
    if (startsWith(stripped, "Success") or startsWith(stripped, "success")) return .success;
    if (startsWith(stripped, UTF8_CHECK_MARK) or startsWith(stripped, UTF8_CHECK)) return .success;

    // Progress
    if (hasPercentage(text)) return .progress;
    if (contains(text, "ETA") or contains(text, "eta")) return .progress;
    if (std.mem.endsWith(u8, stripped, "...")) return .progress;

    // Command: shell prompt patterns
    if (isDollarPrompt(text)) return .command;
    if (isAnglePrompt(text)) return .command;
    if (row <= 3 and stripped.len >= 3 and stripped[0] == '#' and stripped[1] == ' ') return .heading;
    if (isUserHostPrompt(text)) return .command;

    // Heading: short all-caps, or === / --- underlines
    if (isAllCaps(stripped)) return .heading;
    if (stripped.len >= 3) {
        var all_eq = true;
        var all_dash = true;
        for (stripped) |ch| {
            if (ch != '=') all_eq = false;
            if (ch != '-') all_dash = false;
        }
        if (all_eq or all_dash) return .heading;
    }

    return .output;
}

// ── Claude Code classifier ──────────────────────────────────────────
// Port of love2d/lua/classifiers/claude_code.lua

pub fn classifyClaude(text: []const u8, row: u16, total_rows: u16) TokenKind {
    if (text.len == 0) return .plain;

    // Permission prompt: "Do you want to ..."
    if (contains(text, "Do you want to ") and contains(text, "?")) return .permission;

    // Numbered menu options
    if (hasNumberedPrefix(text)) return .menu_option;
    // ❯ followed by numbered option
    if (textAfterChevron(text)) |rest| {
        if (rest.len > 2 and rest[0] >= '0' and rest[0] <= '9') {
            var i: usize = 1;
            while (i < rest.len and rest[i] >= '0' and rest[i] <= '9') i += 1;
            if (i < rest.len and rest[i] == '.' and i + 1 < rest.len and rest[i + 1] == ' ')
                return .menu_option;
        }
    }

    // Banner / version
    if (contains(text, "Claude Code v")) return .banner;
    if (row <= 5 and contains(text, "Claude Code")) return .banner;
    if (row <= 5 and (contains(text, "Opus ") or contains(text, "Sonnet ") or contains(text, "Haiku "))) return .banner;
    if (row <= 5 and contains(text, "~/")) return .banner;

    // Interactive menu elements
    if (contains(text, UTF8_ARROW_LEFT ++ " " ++ UTF8_ARROW_RIGHT) or contains(text, "to adjust")) return .selector;
    if (contains(text, "Enter to confirm")) return .confirmation;
    if (startsWith(trim(text), "Select ")) return .menu_title;

    // Picker
    if (startsWith(trim(text), "Resume Session")) return .picker_title;
    if (contains(text, "ago") and contains(text, UTF8_MIDDOT)) return .picker_meta;

    // Status bar
    if (hasTokenCount(text) or (text.len > 1 and text[0] == '$' and text[1] >= '0' and text[1] <= '9')) return .status_bar;
    if (contains(text, "for shortcuts") or contains(text, "for short") or
        contains(text, "esc to interrupt")) return .status_bar;

    // Input area (bottom 8 rows)
    if (row >= total_rows -| 8) {
        const stripped = trim(text);
        if (contains(stripped, UTF8_BOX_H ++ UTF8_BOX_H ++ UTF8_BOX_H ++ UTF8_BOX_H)) return .input_border;
        if (std.mem.eql(u8, stripped, UTF8_CHEVRON) or std.mem.eql(u8, stripped, ">")) return .input_zone;
        if (textAfterChevron(text) != null and !contains(text, "Imagining")) return .input_zone;
        if (isAnglePrompt(text)) return .input_zone;
    }

    // User prompt: ❯ or > NOT near bottom
    if (!contains(text, "Imagining")) {
        if (textAfterChevron(text) != null) return .user_prompt;
    }
    if (isAnglePrompt(text)) return .user_prompt;

    // Thought complete
    if (contains(text, UTF8_SPARKLE)) return .thought_complete;

    // Task active (live progress with … and token count or ↓)
    if (contains(text, UTF8_ELLIPSIS) and
        (contains(text, UTF8_MIDDOT ++ " " ++ UTF8_ARROW_DOWN) or contains(text, "tokens")))
        return .task_active;

    // Task summary: "N tasks("
    if (contains(text, "tasks(") or contains(text, "task(")) return .task_summary;

    // Task done / open
    if (contains(text, UTF8_CHECK)) return .task_done;
    if (contains(text, UTF8_OPEN_BOX)) return .task_open;

    // Thinking
    if (contains(text, "Imagining") or contains(text, "Thinking")) return .thinking;

    // Plan mode
    if (contains(text, "Entered plan mode") or contains(text, "Exited plan mode")) return .plan_mode;
    if (contains(text, "exploring and designing") or contains(text, "now exploring")) return .plan_mode;

    // Tool use: bullet + function call pattern
    if (hasBulletFuncCall(text)) return .tool;

    // Diff lines
    if (text.len > 0 and (text[0] == '+' or text[0] == '-')) return .diff;

    // Image attachment
    if (contains(text, UTF8_RESULT) and contains(text, "[Image")) return .image_attachment;

    // Result bracket
    if (contains(text, UTF8_RESULT)) return .result;

    // Box drawing
    if (contains(text, UTF8_BOX_TL) or contains(text, UTF8_ROUND_TL) or
        contains(text, UTF8_BOX_V) or
        contains(text, UTF8_BOX_BL) or contains(text, UTF8_ROUND_BL)) return .box_drawing;

    const stripped = trim(text);
    if (contains(stripped, UTF8_DASHED_H ++ UTF8_DASHED_H ++ UTF8_DASHED_H)) return .plan_border;
    if (contains(stripped, UTF8_BOX_H ++ UTF8_BOX_H ++ UTF8_BOX_H ++ UTF8_BOX_H)) return .box_drawing;

    // Wizard step
    if (contains(text, UTF8_SQUARE) and
        (contains(text, UTF8_ARROW_LEFT) or contains(text, UTF8_ARROW_RIGHT))) return .wizard_step;

    // Image attachment standalone
    if (contains(text, "[Image")) return .image_attachment;

    // Error
    if (startsWith(trim(text), "Error:") or startsWith(trim(text), "error:")) return .error_text;

    return .plain;
}

// ── Adjacency refinement ────────────────────────────────────────────
// Context-aware reclassification based on previous row's token kind.

pub fn refineAdjacency(kind: TokenKind, prev_kind: TokenKind, text: []const u8) TokenKind {
    // Plain text after user_prompt/user_text → user_text
    if (kind == .plain and (prev_kind == .user_prompt or prev_kind == .user_text))
        return .user_text;

    // Plain text after assistant-attributed tokens → assistant_text
    if (kind == .plain or kind == .menu_option) {
        if (prev_kind == .tool or prev_kind == .thinking or prev_kind == .thought_complete or
            prev_kind == .result or prev_kind == .assistant_text or
            prev_kind == .task_done or prev_kind == .task_open or
            prev_kind == .task_summary or prev_kind == .task_active or
            prev_kind == .diff or prev_kind == .plan_border)
        {
            return .assistant_text;
        }
    }

    // Plain text after menu_option → menu_desc
    if (kind == .plain and prev_kind == .menu_option) return .menu_desc;

    // Footer hints
    if (kind == .plain) {
        if (contains(text, "Enter to select") or contains(text, "Arrow keys") or
            contains(text, "Esc to cancel") or contains(text, "Esc to go back") or
            contains(text, "Type to search") or
            (contains(text, "Ctrl+") and contains(text, " to ")))
        {
            return .hint;
        }
    }

    return kind;
}

// ── Turn and group detection ────────────────────────────────────────

pub fn isTurnStartBasic(kind: TokenKind) bool {
    return kind == .command;
}

pub fn isTurnStartClaude(kind: TokenKind) bool {
    return kind == .user_prompt;
}

// ── Classifier type ─────────────────────────────────────────────────

pub const ClassifierType = enum(u8) {
    basic,
    claude_code,
};

// ── Global module API ───────────────────────────────────────────────

var g_classifier: ClassifierType = .basic;
var g_prev_kind: TokenKind = .plain;

/// Set the active classifier.
pub fn setClassifier(ct: ClassifierType) void {
    g_classifier = ct;
    g_prev_kind = .plain;
}

/// Classify a row of text. Applies adjacency refinement automatically.
pub fn classifyRow(text: []const u8, row: u16, total_rows: u16) u8 {
    const raw_kind = switch (g_classifier) {
        .basic => classifyBasic(text, row, total_rows),
        .claude_code => classifyClaude(text, row, total_rows),
    };

    // Apply adjacency refinement (only for claude_code)
    const kind = if (g_classifier == .claude_code)
        refineAdjacency(raw_kind, g_prev_kind, text)
    else
        raw_kind;

    g_prev_kind = kind;
    return @intFromEnum(kind);
}

/// Reset adjacency state (call when scrolling or switching views).
pub fn resetClassifier() void {
    g_prev_kind = .plain;
}

// ── Token color palette ─────────────────────────────────────────────
// Catppuccin-inspired colors for semantic token rendering.

pub const TokenColor = struct { r: u8, g: u8, b: u8 };

pub const TOKEN_COLORS = [_]TokenColor{
    // Basic tokens
    .{ .r = 137, .g = 180, .b = 250 }, // command — blue
    .{ .r = 205, .g = 214, .b = 244 }, // output — light text
    .{ .r = 243, .g = 139, .b = 168 }, // err — red
    .{ .r = 166, .g = 227, .b = 161 }, // success — green
    .{ .r = 245, .g = 224, .b = 220 }, // heading — rosewater
    .{ .r = 88, .g = 91, .b = 112 }, // separator — overlay0
    .{ .r = 249, .g = 226, .b = 175 }, // progress — yellow

    // Claude Code tokens
    .{ .r = 96, .g = 165, .b = 250 }, // user_prompt — blue
    .{ .r = 148, .g = 163, .b = 184 }, // user_text — muted
    .{ .r = 148, .g = 163, .b = 184 }, // user_input — muted
    .{ .r = 167, .g = 139, .b = 250 }, // thinking — purple
    .{ .r = 167, .g = 139, .b = 250 }, // thought_complete — purple
    .{ .r = 226, .g = 232, .b = 240 }, // assistant_text — light gray
    .{ .r = 234, .g = 179, .b = 8 }, // tool — yellow
    .{ .r = 74, .g = 222, .b = 128 }, // result — green
    .{ .r = 56, .g = 189, .b = 248 }, // diff — sky
    .{ .r = 248, .g = 113, .b = 113 }, // error_text — red
    .{ .r = 96, .g = 165, .b = 250 }, // banner — blue
    .{ .r = 100, .g = 116, .b = 139 }, // status_bar — muted
    .{ .r = 96, .g = 165, .b = 250 }, // idle_prompt — blue
    .{ .r = 71, .g = 85, .b = 105 }, // input_border — dim
    .{ .r = 226, .g = 232, .b = 240 }, // input_zone — light
    .{ .r = 71, .g = 85, .b = 105 }, // box_drawing — dim
    .{ .r = 249, .g = 226, .b = 175 }, // menu_title — yellow
    .{ .r = 226, .g = 232, .b = 240 }, // menu_option — light
    .{ .r = 148, .g = 163, .b = 184 }, // menu_desc — muted
    .{ .r = 226, .g = 232, .b = 240 }, // list_selectable — light
    .{ .r = 96, .g = 165, .b = 250 }, // list_selected — blue
    .{ .r = 148, .g = 163, .b = 184 }, // list_info — muted
    .{ .r = 226, .g = 232, .b = 240 }, // search_box — light
    .{ .r = 96, .g = 165, .b = 250 }, // selector — blue
    .{ .r = 74, .g = 222, .b = 128 }, // confirmation — green
    .{ .r = 100, .g = 116, .b = 139 }, // hint — muted
    .{ .r = 249, .g = 226, .b = 175 }, // picker_title — yellow
    .{ .r = 226, .g = 232, .b = 240 }, // picker_item — light
    .{ .r = 96, .g = 165, .b = 250 }, // picker_selected — blue
    .{ .r = 100, .g = 116, .b = 139 }, // picker_meta — muted
    .{ .r = 248, .g = 113, .b = 113 }, // permission — red
    .{ .r = 167, .g = 139, .b = 250 }, // plan_border — purple
    .{ .r = 167, .g = 139, .b = 250 }, // plan_mode — purple
    .{ .r = 167, .g = 139, .b = 250 }, // wizard_step — purple
    .{ .r = 100, .g = 116, .b = 139 }, // task_summary — muted
    .{ .r = 74, .g = 222, .b = 128 }, // task_done — green
    .{ .r = 148, .g = 163, .b = 184 }, // task_open — muted
    .{ .r = 96, .g = 165, .b = 250 }, // task_active — blue
    .{ .r = 148, .g = 163, .b = 184 }, // slash_menu — muted
    .{ .r = 148, .g = 163, .b = 184 }, // image_attachment — muted

    // plain fallback
    .{ .r = 205, .g = 214, .b = 244 }, // plain — default text
};

/// Get the color for a token kind.
pub fn getTokenColor(kind_idx: u8) TokenColor {
    if (kind_idx < TOKEN_COLORS.len) return TOKEN_COLORS[kind_idx];
    return TOKEN_COLORS[TOKEN_COLORS.len - 1]; // plain fallback
}
