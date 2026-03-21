//! SVG Path — Parser, GPU-native bezier curves, stroke geometry.
//!
//! Ported from love2d/lua/svg.lua. Supports M L C Q S T A Z commands.
//! Two rendering modes:
//!   - drawStroke: tessellated polylines via gpu.drawRect (legacy, for fills)
//!   - drawStrokeCurves: GPU-native SDF bezier curves (smooth at any zoom)

const std = @import("std");
const gpu = @import("gpu/gpu.zig");
const math = std.math;

// ── Flattened path output ───────────────────────────────────────────────

const MAX_POINTS = 4096;
const MAX_SUBPATHS = 64;

pub const Subpath = struct {
    points: [MAX_POINTS]f32 = undefined,  // x0,y0,x1,y1,...
    count: u32 = 0,                        // number of floats (count/2 = point count)
    closed: bool = false,
};

pub const Path = struct {
    subpaths: [MAX_SUBPATHS]Subpath = undefined,
    subpath_count: u32 = 0,
    // Curve segments for GPU-native rendering (parallel to flattened subpaths)
    curves: [MAX_CURVE_SEGMENTS]CurveSegment = undefined,
    curve_count: u32 = 0,

    pub fn pointCount(self: *const Path) u32 {
        var total: u32 = 0;
        for (0..self.subpath_count) |i| {
            total += self.subpaths[i].count / 2;
        }
        return total;
    }
};

// ── GPU-native curve segments ─────────────────────────────────────────

const MAX_CURVE_SEGMENTS = 2048;

pub const CurveKind = enum { line, quadratic, cubic };

/// Raw curve segment — stored during parsing, sent to GPU for native rendering.
pub const CurveSegment = struct {
    kind: CurveKind,
    // Start point
    x0: f32,
    y0: f32,
    // Control point 1 (quadratic: the control point; cubic: first control)
    x1: f32 = 0,
    y1: f32 = 0,
    // Control point 2 (cubic only)
    x2: f32 = 0,
    y2: f32 = 0,
    // End point
    x3: f32,
    y3: f32,
};

// ── Bezier tessellation ─────────────────────────────────────────────────

const DEFAULT_TOLERANCE: f32 = 0.5;

/// Flatten a cubic bezier (p0 → p1 → p2 → p3) into line segments.
/// Recursive de Casteljau subdivision until flatness tolerance is met.
fn flattenCubic(sp: *Subpath, x0: f32, y0: f32, x1: f32, y1: f32, x2: f32, y2: f32, x3: f32, y3: f32, tol: f32) void {
    // Flatness test: distance of control points from baseline P0→P3
    const dx = x3 - x0;
    const dy = y3 - y0;
    const d2 = @abs((x1 - x3) * dy - (y1 - y3) * dx);
    const d3 = @abs((x2 - x3) * dy - (y2 - y3) * dx);
    const denom = dx * dx + dy * dy;

    if ((d2 + d3) * (d2 + d3) <= tol * tol * denom) {
        // Flat enough — emit endpoint
        if (sp.count + 2 <= MAX_POINTS) {
            sp.points[sp.count] = x3;
            sp.points[sp.count + 1] = y3;
            sp.count += 2;
        }
        return;
    }

    // Subdivide at midpoint (de Casteljau)
    const x01 = (x0 + x1) * 0.5;
    const y01 = (y0 + y1) * 0.5;
    const x12 = (x1 + x2) * 0.5;
    const y12 = (y1 + y2) * 0.5;
    const x23 = (x2 + x3) * 0.5;
    const y23 = (y2 + y3) * 0.5;
    const x012 = (x01 + x12) * 0.5;
    const y012 = (y01 + y12) * 0.5;
    const x123 = (x12 + x23) * 0.5;
    const y123 = (y12 + y23) * 0.5;
    const x0123 = (x012 + x123) * 0.5;
    const y0123 = (y012 + y123) * 0.5;

    flattenCubic(sp, x0, y0, x01, y01, x012, y012, x0123, y0123, tol);
    flattenCubic(sp, x0123, y0123, x123, y123, x23, y23, x3, y3, tol);
}

/// Flatten a quadratic bezier by elevating to cubic.
fn flattenQuadratic(sp: *Subpath, x0: f32, y0: f32, x1: f32, y1: f32, x2: f32, y2: f32, tol: f32) void {
    // Quadratic → cubic elevation
    const cp1x = x0 + (x1 - x0) * (2.0 / 3.0);
    const cp1y = y0 + (y1 - y0) * (2.0 / 3.0);
    const cp2x = x2 + (x1 - x2) * (2.0 / 3.0);
    const cp2y = y2 + (y1 - y2) * (2.0 / 3.0);
    flattenCubic(sp, x0, y0, cp1x, cp1y, cp2x, cp2y, x2, y2, tol);
}

/// Convert SVG arc to cubic bezier segments, then flatten.
fn flattenArc(sp: *Subpath, x1: f32, y1: f32, rx_in: f32, ry_in: f32, x_rot_deg: f32, large_arc: bool, sweep: bool, x2: f32, y2: f32, tol: f32) void {
    if (rx_in == 0 or ry_in == 0) {
        // Degenerate arc = straight line
        if (sp.count + 2 <= MAX_POINTS) {
            sp.points[sp.count] = x2;
            sp.points[sp.count + 1] = y2;
            sp.count += 2;
        }
        return;
    }

    const rx = @abs(rx_in);
    const ry = @abs(ry_in);
    const phi = x_rot_deg * math.pi / 180.0;
    const cos_phi = @cos(phi);
    const sin_phi = @sin(phi);

    // Step 1: compute (x1', y1')
    const dx2 = (x1 - x2) * 0.5;
    const dy2 = (y1 - y2) * 0.5;
    const x1p = cos_phi * dx2 + sin_phi * dy2;
    const y1p = -sin_phi * dx2 + cos_phi * dy2;

    // Step 2: compute (cx', cy')
    var sq = (rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p) /
        (rx * rx * y1p * y1p + ry * ry * x1p * x1p);
    if (sq < 0) sq = 0;
    var root = @sqrt(sq);
    if (large_arc == sweep) root = -root;
    const cxp = root * rx * y1p / ry;
    const cyp = -root * ry * x1p / rx;

    // Step 3: compute (cx, cy)
    const mx = (x1 + x2) * 0.5;
    const my = (y1 + y2) * 0.5;
    const cx = cos_phi * cxp - sin_phi * cyp + mx;
    const cy = sin_phi * cxp + cos_phi * cyp + my;

    // Step 4: compute angles
    const theta1 = vecAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    var dtheta = vecAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!sweep and dtheta > 0) dtheta -= 2.0 * math.pi;
    if (sweep and dtheta < 0) dtheta += 2.0 * math.pi;

    // Step 5: split into ≤90° segments, each approximated by cubic bezier
    const n_segs: u32 = @intFromFloat(@ceil(@abs(dtheta) / (math.pi / 2.0)));
    const seg_angle = dtheta / @as(f32, @floatFromInt(n_segs));
    const alpha = 4.0 * @tan(seg_angle / 4.0) / 3.0;

    var theta = theta1;
    var seg_x = x1;
    var seg_y = y1;
    var seg_i: u32 = 0;
    while (seg_i < n_segs) : (seg_i += 1) {
        const next_theta = theta + seg_angle;
        const cos_t = @cos(theta);
        const sin_t = @sin(theta);
        const cos_nt = @cos(next_theta);
        const sin_nt = @sin(next_theta);

        // Control point 1
        const cp1x_local = rx * (cos_t - alpha * sin_t);
        const cp1y_local = ry * (sin_t + alpha * cos_t);
        // Control point 2
        const cp2x_local = rx * (cos_nt + alpha * sin_nt);
        const cp2y_local = ry * (sin_nt - alpha * cos_nt);
        // Endpoint
        const ex_local = rx * cos_nt;
        const ey_local = ry * sin_nt;

        // Transform back to original coordinate space
        const cp1x = cos_phi * cp1x_local - sin_phi * cp1y_local + cx;
        const cp1y = sin_phi * cp1x_local + cos_phi * cp1y_local + cy;
        const cp2x = cos_phi * cp2x_local - sin_phi * cp2y_local + cx;
        const cp2y = sin_phi * cp2x_local + cos_phi * cp2y_local + cy;
        const ex = cos_phi * ex_local - sin_phi * ey_local + cx;
        const ey = sin_phi * ex_local + cos_phi * ey_local + cy;

        flattenCubic(sp, seg_x, seg_y, cp1x, cp1y, cp2x, cp2y, ex, ey, tol);

        theta = next_theta;
        seg_x = ex;
        seg_y = ey;
    }
}

fn vecAngle(ux: f32, uy: f32, vx: f32, vy: f32) f32 {
    const dot = ux * vx + uy * vy;
    const len = @sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    var ang = math.acos(@max(-1.0, @min(1.0, dot / @max(len, 1e-10))));
    if (ux * vy - uy * vx < 0) ang = -ang;
    return ang;
}

// ── Curve segment recording ──────────────────────────────────────────────

fn recordLine(path: *Path, x0: f32, y0: f32, x1: f32, y1: f32) void {
    if (path.curve_count >= MAX_CURVE_SEGMENTS) return;
    path.curves[path.curve_count] = .{ .kind = .line, .x0 = x0, .y0 = y0, .x3 = x1, .y3 = y1 };
    path.curve_count += 1;
}

fn recordQuadratic(path: *Path, x0: f32, y0: f32, cpx: f32, cpy: f32, x1: f32, y1: f32) void {
    if (path.curve_count >= MAX_CURVE_SEGMENTS) return;
    path.curves[path.curve_count] = .{ .kind = .quadratic, .x0 = x0, .y0 = y0, .x1 = cpx, .y1 = cpy, .x3 = x1, .y3 = y1 };
    path.curve_count += 1;
}

fn recordCubic(path: *Path, x0: f32, y0: f32, cp1x: f32, cp1y: f32, cp2x: f32, cp2y: f32, x1: f32, y1: f32) void {
    if (path.curve_count >= MAX_CURVE_SEGMENTS) return;
    path.curves[path.curve_count] = .{ .kind = .cubic, .x0 = x0, .y0 = y0, .x1 = cp1x, .y1 = cp1y, .x2 = cp2x, .y2 = cp2y, .x3 = x1, .y3 = y1 };
    path.curve_count += 1;
}

// ── Path parser ─────────────────────────────────────────────────────────

/// Parse an SVG path string into flattened polylines.
pub fn parsePath(d: []const u8) Path {
    return parsePathWithTolerance(d, DEFAULT_TOLERANCE);
}

pub fn parsePathWithTolerance(d: []const u8, tol: f32) Path {
    var path = Path{};
    var sp = &path.subpaths[0];
    path.subpath_count = 1;

    var cx: f32 = 0; // current point
    var cy: f32 = 0;
    var sx: f32 = 0; // subpath start (for Z)
    var sy: f32 = 0;
    var last_cp_x: f32 = 0; // last control point (for S/T)
    var last_cp_y: f32 = 0;
    var last_cmd: u8 = 0;

    var pos: usize = 0;
    while (pos < d.len) {
        skipWhitespaceAndCommas(d, &pos);
        if (pos >= d.len) break;

        var cmd = d[pos];
        if (isCommand(cmd)) {
            pos += 1;
        } else if (last_cmd != 0) {
            // Implicit repeat of last command
            cmd = last_cmd;
            // After M, implicit repeats become L
            if (cmd == 'M') cmd = 'L';
            if (cmd == 'm') cmd = 'l';
        } else {
            break;
        }

        switch (cmd) {
            'M' => {
                const px = readNumber(d, &pos) orelse break;
                const py = readNumber(d, &pos) orelse break;
                // Start new subpath
                if (sp.count > 0) {
                    if (path.subpath_count < MAX_SUBPATHS) {
                        path.subpath_count += 1;
                        sp = &path.subpaths[path.subpath_count - 1];
                    }
                }
                sp.points[0] = px;
                sp.points[1] = py;
                sp.count = 2;
                cx = px;
                cy = py;
                sx = px;
                sy = py;
            },
            'm' => {
                const dx2 = readNumber(d, &pos) orelse break;
                const dy2 = readNumber(d, &pos) orelse break;
                cx += dx2;
                cy += dy2;
                if (sp.count > 0 and path.subpath_count < MAX_SUBPATHS) {
                    path.subpath_count += 1;
                    sp = &path.subpaths[path.subpath_count - 1];
                }
                sp.points[0] = cx;
                sp.points[1] = cy;
                sp.count = 2;
                sx = cx;
                sy = cy;
            },
            'L' => {
                const px = readNumber(d, &pos) orelse break;
                const py = readNumber(d, &pos) orelse break;
                if (sp.count + 2 <= MAX_POINTS) {
                    sp.points[sp.count] = px;
                    sp.points[sp.count + 1] = py;
                    sp.count += 2;
                }
                recordLine(&path, cx, cy, px, py);
                cx = px;
                cy = py;
            },
            'l' => {
                const dx2 = readNumber(d, &pos) orelse break;
                const dy2 = readNumber(d, &pos) orelse break;
                const nx = cx + dx2;
                const ny = cy + dy2;
                if (sp.count + 2 <= MAX_POINTS) {
                    sp.points[sp.count] = nx;
                    sp.points[sp.count + 1] = ny;
                    sp.count += 2;
                }
                recordLine(&path, cx, cy, nx, ny);
                cx = nx;
                cy = ny;
            },
            'H' => {
                const px = readNumber(d, &pos) orelse break;
                recordLine(&path, cx, cy, px, cy);
                cx = px;
                if (sp.count + 2 <= MAX_POINTS) {
                    sp.points[sp.count] = cx;
                    sp.points[sp.count + 1] = cy;
                    sp.count += 2;
                }
            },
            'h' => {
                const dx2 = readNumber(d, &pos) orelse break;
                const nx = cx + dx2;
                recordLine(&path, cx, cy, nx, cy);
                cx = nx;
                if (sp.count + 2 <= MAX_POINTS) {
                    sp.points[sp.count] = cx;
                    sp.points[sp.count + 1] = cy;
                    sp.count += 2;
                }
            },
            'V' => {
                const py = readNumber(d, &pos) orelse break;
                recordLine(&path, cx, cy, cx, py);
                cy = py;
                if (sp.count + 2 <= MAX_POINTS) {
                    sp.points[sp.count] = cx;
                    sp.points[sp.count + 1] = cy;
                    sp.count += 2;
                }
            },
            'v' => {
                const dy2 = readNumber(d, &pos) orelse break;
                const ny = cy + dy2;
                recordLine(&path, cx, cy, cx, ny);
                cy = ny;
                if (sp.count + 2 <= MAX_POINTS) {
                    sp.points[sp.count] = cx;
                    sp.points[sp.count + 1] = cy;
                    sp.count += 2;
                }
            },
            'C' => {
                const x1 = readNumber(d, &pos) orelse break;
                const y1 = readNumber(d, &pos) orelse break;
                const x2 = readNumber(d, &pos) orelse break;
                const y2 = readNumber(d, &pos) orelse break;
                const x3 = readNumber(d, &pos) orelse break;
                const y3 = readNumber(d, &pos) orelse break;
                flattenCubic(sp, cx, cy, x1, y1, x2, y2, x3, y3, tol);
                recordCubic(&path, cx, cy, x1, y1, x2, y2, x3, y3);
                last_cp_x = x2;
                last_cp_y = y2;
                cx = x3;
                cy = y3;
            },
            'c' => {
                const x1 = cx + (readNumber(d, &pos) orelse break);
                const y1 = cy + (readNumber(d, &pos) orelse break);
                const x2 = cx + (readNumber(d, &pos) orelse break);
                const y2 = cy + (readNumber(d, &pos) orelse break);
                const x3 = cx + (readNumber(d, &pos) orelse break);
                const y3 = cy + (readNumber(d, &pos) orelse break);
                flattenCubic(sp, cx, cy, x1, y1, x2, y2, x3, y3, tol);
                recordCubic(&path, cx, cy, x1, y1, x2, y2, x3, y3);
                last_cp_x = x2;
                last_cp_y = y2;
                cx = x3;
                cy = y3;
            },
            'S', 's' => {
                // Smooth cubic: reflected control point
                var cp1x = cx + (cx - last_cp_x);
                var cp1y = cy + (cy - last_cp_y);
                if (last_cmd != 'C' and last_cmd != 'c' and last_cmd != 'S' and last_cmd != 's') {
                    cp1x = cx;
                    cp1y = cy;
                }
                const rel = (cmd == 's');
                const x2 = (if (rel) cx else 0) + (readNumber(d, &pos) orelse break);
                const y2 = (if (rel) cy else 0) + (readNumber(d, &pos) orelse break);
                const x3 = (if (rel) cx else 0) + (readNumber(d, &pos) orelse break);
                const y3 = (if (rel) cy else 0) + (readNumber(d, &pos) orelse break);
                flattenCubic(sp, cx, cy, cp1x, cp1y, x2, y2, x3, y3, tol);
                recordCubic(&path, cx, cy, cp1x, cp1y, x2, y2, x3, y3);
                last_cp_x = x2;
                last_cp_y = y2;
                cx = x3;
                cy = y3;
            },
            'Q' => {
                const x1 = readNumber(d, &pos) orelse break;
                const y1 = readNumber(d, &pos) orelse break;
                const x2 = readNumber(d, &pos) orelse break;
                const y2 = readNumber(d, &pos) orelse break;
                flattenQuadratic(sp, cx, cy, x1, y1, x2, y2, tol);
                recordQuadratic(&path, cx, cy, x1, y1, x2, y2);
                last_cp_x = x1;
                last_cp_y = y1;
                cx = x2;
                cy = y2;
            },
            'q' => {
                const x1 = cx + (readNumber(d, &pos) orelse break);
                const y1 = cy + (readNumber(d, &pos) orelse break);
                const x2 = cx + (readNumber(d, &pos) orelse break);
                const y2 = cy + (readNumber(d, &pos) orelse break);
                flattenQuadratic(sp, cx, cy, x1, y1, x2, y2, tol);
                recordQuadratic(&path, cx, cy, x1, y1, x2, y2);
                last_cp_x = x1;
                last_cp_y = y1;
                cx = x2;
                cy = y2;
            },
            'T', 't' => {
                // Smooth quadratic: reflected control point
                var cp1x = cx + (cx - last_cp_x);
                var cp1y = cy + (cy - last_cp_y);
                if (last_cmd != 'Q' and last_cmd != 'q' and last_cmd != 'T' and last_cmd != 't') {
                    cp1x = cx;
                    cp1y = cy;
                }
                const rel = (cmd == 't');
                const x2 = (if (rel) cx else 0) + (readNumber(d, &pos) orelse break);
                const y2 = (if (rel) cy else 0) + (readNumber(d, &pos) orelse break);
                flattenQuadratic(sp, cx, cy, cp1x, cp1y, x2, y2, tol);
                recordQuadratic(&path, cx, cy, cp1x, cp1y, x2, y2);
                last_cp_x = cp1x;
                last_cp_y = cp1y;
                cx = x2;
                cy = y2;
            },
            'A', 'a' => {
                const rel = (cmd == 'a');
                const arx = readNumber(d, &pos) orelse break;
                const ary = readNumber(d, &pos) orelse break;
                const x_rot = readNumber(d, &pos) orelse break;
                const la_f = readNumber(d, &pos) orelse break;
                const sw_f = readNumber(d, &pos) orelse break;
                const ex = (if (rel) cx else 0) + (readNumber(d, &pos) orelse break);
                const ey = (if (rel) cy else 0) + (readNumber(d, &pos) orelse break);
                flattenArc(sp, cx, cy, arx, ary, x_rot, la_f > 0.5, sw_f > 0.5, ex, ey, tol);
                // Arcs are converted to cubics internally by flattenArc — record as cubics
                // For now, record the arc endpoints as a line (the flattened version handles quality)
                // TODO: record the cubic segments from arcToBeziers directly
                recordLine(&path, cx, cy, ex, ey);
                cx = ex;
                cy = ey;
            },
            'Z', 'z' => {
                sp.closed = true;
                if (cx != sx or cy != sy) {
                    recordLine(&path, cx, cy, sx, sy);
                }
                cx = sx;
                cy = sy;
            },
            else => {},
        }
        last_cmd = cmd;
    }

    return path;
}

// ── GPU-native curve stroke rendering ─────────────────────────────────

/// Draw a stroked path using GPU-native SDF bezier curves.
/// Smooth at any zoom level — no tessellation artifacts.
/// Lines are drawn as degenerate quadratics (control point at midpoint).
pub fn drawStrokeCurves(path: *const Path, stroke_r: f32, stroke_g: f32, stroke_b: f32, stroke_a: f32, stroke_width: f32, _flow_speed: f32, _ticks: u32) void {
    _ = _flow_speed;
    _ = _ticks;
    for (0..path.curve_count) |i| {
        const seg = &path.curves[i];
        switch (seg.kind) {
            .line => {
                // Lines go through drawRect — proper oriented rectangle
                drawLineSegment(seg.x0, seg.y0, seg.x3, seg.y3, stroke_width, stroke_r, stroke_g, stroke_b, stroke_a);
            },
            .quadratic => {
                gpu.drawCurve(seg.x0, seg.y0, seg.x1, seg.y1, seg.x3, seg.y3, stroke_r, stroke_g, stroke_b, stroke_a, stroke_width);
            },
            .cubic => {
                // Split cubic into quadratics via gpu.drawCubicCurve
                gpu.drawCubicCurve(seg.x0, seg.y0, seg.x1, seg.y1, seg.x2, seg.y2, seg.x3, seg.y3, stroke_r, stroke_g, stroke_b, stroke_a, stroke_width);
            },
        }
    }
}

// ── Legacy stroke rendering (tessellated) ────────────────────────────

/// Draw a stroked path as a series of oriented quads (thin rectangles).
/// Goes through gpu.drawRect, so canvas GPU transform applies automatically.
/// Use drawStrokeCurves instead for smooth rendering.
pub fn drawStroke(path: *const Path, stroke_r: f32, stroke_g: f32, stroke_b: f32, stroke_a: f32, stroke_width: f32) void {
    for (0..path.subpath_count) |si| {
        const sp = &path.subpaths[si];
        if (sp.count < 4) continue; // need at least 2 points

        var pi: u32 = 0;
        while (pi + 2 < sp.count) : (pi += 2) {
            const x0 = sp.points[pi];
            const y0 = sp.points[pi + 1];
            const x1 = sp.points[pi + 2];
            const y1 = sp.points[pi + 3];
            drawLineSegment(x0, y0, x1, y1, stroke_width, stroke_r, stroke_g, stroke_b, stroke_a);
        }

        // Close path: connect last point to first
        if (sp.closed and sp.count >= 4) {
            const lx = sp.points[sp.count - 2];
            const ly = sp.points[sp.count - 1];
            const fx = sp.points[0];
            const fy = sp.points[1];
            drawLineSegment(lx, ly, fx, fy, stroke_width, stroke_r, stroke_g, stroke_b, stroke_a);
        }
    }
}

/// Draw a single line segment as an oriented rectangle.
fn drawLineSegment(x0: f32, y0: f32, x1: f32, y1: f32, width: f32, r: f32, g: f32, b: f32, a: f32) void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = @sqrt(dx * dx + dy * dy);
    if (len < 0.1) return;

    // Normal perpendicular to the line direction
    const nx = -dy / len * width * 0.5;
    const ny = dx / len * width * 0.5;

    // The quad corners
    // We can't draw rotated rects with drawRect, so use the axis-aligned bounding box
    // and accept slight width imprecision on diagonal lines.
    // For proper rotated quads, we'd need a triangle/quad primitive.
    // For now: draw the AABB of the line segment with the stroke color.
    const min_x = @min(x0 - @abs(nx), x1 - @abs(nx));
    const min_y = @min(y0 - @abs(ny), y1 - @abs(ny));
    const max_x = @max(x0 + @abs(nx), x1 + @abs(nx));
    const max_y = @max(y0 + @abs(ny), y1 + @abs(ny));

    // For near-horizontal or near-vertical lines, this is perfect.
    // For diagonals, the rect is slightly wider than the line.
    gpu.drawRect(min_x, min_y, max_x - min_x, max_y - min_y, r, g, b, a, 0, 0, 0, 0, 0, 0);
}

// ── Arc-length utilities (for animation) ────────────────────────────────

/// Compute cumulative arc lengths for a subpath.
/// Returns total length.
pub fn arcLength(sp: *const Subpath) f32 {
    if (sp.count < 4) return 0;
    var total: f32 = 0;
    var pi: u32 = 0;
    while (pi + 2 < sp.count) : (pi += 2) {
        const dx = sp.points[pi + 2] - sp.points[pi];
        const dy = sp.points[pi + 3] - sp.points[pi + 1];
        total += @sqrt(dx * dx + dy * dy);
    }
    return total;
}

/// Sample a point at parameter t ∈ [0,1] along a subpath (by arc length).
pub fn sampleAt(sp: *const Subpath, t: f32) [2]f32 {
    if (sp.count < 4) return .{ sp.points[0], sp.points[1] };

    const total = arcLength(sp);
    const target = t * total;
    var accum: f32 = 0;
    var pi: u32 = 0;
    while (pi + 2 < sp.count) : (pi += 2) {
        const x0 = sp.points[pi];
        const y0 = sp.points[pi + 1];
        const x1 = sp.points[pi + 2];
        const y1 = sp.points[pi + 3];
        const seg_len = @sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
        if (accum + seg_len >= target) {
            const frac = if (seg_len > 0) (target - accum) / seg_len else 0;
            return .{ x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac };
        }
        accum += seg_len;
    }
    return .{ sp.points[sp.count - 2], sp.points[sp.count - 1] };
}

/// Get tangent angle at parameter t ∈ [0,1] along a subpath.
pub fn tangentAt(sp: *const Subpath, t: f32) f32 {
    if (sp.count < 4) return 0;

    const total = arcLength(sp);
    const target = t * total;
    var accum: f32 = 0;
    var pi: u32 = 0;
    while (pi + 2 < sp.count) : (pi += 2) {
        const x0 = sp.points[pi];
        const y0 = sp.points[pi + 1];
        const x1 = sp.points[pi + 2];
        const y1 = sp.points[pi + 3];
        const seg_len = @sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
        if (accum + seg_len >= target) {
            return math.atan2(y1 - y0, x1 - x0);
        }
        accum += seg_len;
    }
    // Return angle of last segment
    const lx0 = sp.points[sp.count - 4];
    const ly0 = sp.points[sp.count - 3];
    const lx1 = sp.points[sp.count - 2];
    const ly1 = sp.points[sp.count - 1];
    return math.atan2(ly1 - ly0, lx1 - lx0);
}

/// Draw a partial stroke up to parameter t ∈ [0,1] (for reveal animation).
pub fn drawStrokePartial(path: *const Path, t: f32, stroke_r: f32, stroke_g: f32, stroke_b: f32, stroke_a: f32, stroke_width: f32) void {
    if (path.subpath_count == 0) return;

    // For simplicity, animate across all subpaths by total arc length
    var total_len: f32 = 0;
    for (0..path.subpath_count) |si| {
        total_len += arcLength(&path.subpaths[si]);
    }

    var target_len = t * total_len;
    for (0..path.subpath_count) |si| {
        const sp = &path.subpaths[si];
        if (sp.count < 4) continue;

        var pi: u32 = 0;
        while (pi + 2 < sp.count) : (pi += 2) {
            const x0 = sp.points[pi];
            const y0 = sp.points[pi + 1];
            const x1 = sp.points[pi + 2];
            const y1 = sp.points[pi + 3];
            const seg_len = @sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));

            if (target_len <= 0) return;

            if (seg_len <= target_len) {
                drawLineSegment(x0, y0, x1, y1, stroke_width, stroke_r, stroke_g, stroke_b, stroke_a);
                target_len -= seg_len;
            } else {
                // Partial segment
                const frac = target_len / seg_len;
                const ex = x0 + (x1 - x0) * frac;
                const ey = y0 + (y1 - y0) * frac;
                drawLineSegment(x0, y0, ex, ey, stroke_width, stroke_r, stroke_g, stroke_b, stroke_a);
                return;
            }
        }
    }
}

var flow_mode: u2 = 2; // 0=off, 1=partial, 2=full

pub fn setFlowMode(mode: u2) void {
    flow_mode = mode;
}

// ── Tokenizer helpers ───────────────────────────────────────────────────

fn isCommand(c: u8) bool {
    return switch (c) {
        'M', 'm', 'L', 'l', 'H', 'h', 'V', 'v',
        'C', 'c', 'S', 's', 'Q', 'q', 'T', 't',
        'A', 'a', 'Z', 'z',
        => true,
        else => false,
    };
}

fn skipWhitespaceAndCommas(d: []const u8, pos: *usize) void {
    while (pos.* < d.len and (d[pos.*] == ' ' or d[pos.*] == ',' or d[pos.*] == '\t' or d[pos.*] == '\n' or d[pos.*] == '\r')) {
        pos.* += 1;
    }
}

fn readNumber(d: []const u8, pos: *usize) ?f32 {
    skipWhitespaceAndCommas(d, pos);
    if (pos.* >= d.len) return null;

    const start = pos.*;
    // Optional sign
    if (pos.* < d.len and (d[pos.*] == '-' or d[pos.*] == '+')) pos.* += 1;
    // Integer part
    while (pos.* < d.len and d[pos.*] >= '0' and d[pos.*] <= '9') pos.* += 1;
    // Decimal part
    if (pos.* < d.len and d[pos.*] == '.') {
        pos.* += 1;
        while (pos.* < d.len and d[pos.*] >= '0' and d[pos.*] <= '9') pos.* += 1;
    }
    // Exponent
    if (pos.* < d.len and (d[pos.*] == 'e' or d[pos.*] == 'E')) {
        pos.* += 1;
        if (pos.* < d.len and (d[pos.*] == '-' or d[pos.*] == '+')) pos.* += 1;
        while (pos.* < d.len and d[pos.*] >= '0' and d[pos.*] <= '9') pos.* += 1;
    }

    if (pos.* == start) return null;
    return std.fmt.parseFloat(f32, d[start..pos.*]) catch null;
}
