#!/bin/bash
# Networking + Payload Digestion Benchmark Suite
# Tests TCP/HTTP performance AND JSON parsing/bridge cost across Zig, LuaJIT, QuickJS
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE_DIR"
RESULTS_FILE="$BASE_DIR/RESULTS.md"
SAMPLES=3  # median of 3 runs

# Port assignments
ZIG_ECHO_PORT=9100
ZIG_HTTP_PORT=9101
LUAJIT_ECHO_PORT=9200
LUAJIT_HTTP_PORT=9201
QJS_ECHO_PORT=9300
QJS_HTTP_PORT=9301

PIDS=()

cleanup() {
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
}
trap cleanup EXIT

echo "=== Networking + Payload Benchmark Suite ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Samples per test: $SAMPLES (median reported)"
echo ""

# ─── Build Phase ───
echo "Building..."

zig build-exe -OReleaseFast zig/echo_server.zig -femit-bin=zig/echo_server_bin 2>&1

cat > /tmp/_zig_http_srv.zig << 'EOF'
const std = @import("std");
const net = std.net;
pub fn main() !void {
    const address = net.Address.initIp4(.{ 127, 0, 0, 1 }, 9101);
    var server = try address.listen(.{ .reuse_address = true });
    defer server.deinit();
    std.debug.print("Zig HTTP server on :9101\n", .{});
    while (true) {
        const conn = server.accept() catch continue;
        defer conn.stream.close();
        var buf: [4096]u8 = undefined;
        const n = conn.stream.read(&buf) catch continue;
        if (n == 0) continue;
        if (std.mem.startsWith(u8, buf[0..n], "GET ")) {
            conn.stream.writeAll("HTTP/1.1 200 OK\r\nContent-Length: 13\r\nConnection: close\r\n\r\nHello, World!") catch {};
        } else {
            conn.stream.writeAll("HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n") catch {};
        }
    }
}
EOF
zig build-exe -OReleaseFast /tmp/_zig_http_srv.zig -femit-bin=zig/http_server_bin 2>&1
zig build-exe -OReleaseFast bench.zig -femit-bin=bench_bin 2>&1
zig build-exe -OReleaseFast zig/payload_bench.zig -femit-bin=zig/payload_bench_bin 2>&1
bash quickjs/build.sh 2>&1
cc -O2 -o quickjs/bridge_bench quickjs/bridge_bench.c -I/tmp/quickjs-local/include -L/tmp/quickjs-local/lib -lqjs -lm -lpthread 2>&1

# Generate payloads if needed
python3 gen_payloads.py

echo "Build complete."
echo ""

# ─── Helper: run N samples, return median ───
# Expects the command to output a single TSV line
# Returns the median line (by elapsed_us column, 4th field)
median_of() {
    local cmd="$1"
    local tmpfile=$(mktemp)
    for i in $(seq 1 $SAMPLES); do
        eval "$cmd" >> "$tmpfile" 2>/dev/null || true
    done
    # Sort by 4th field (elapsed_us), take median
    sort -t$'\t' -k4 -n "$tmpfile" | sed -n "$((($SAMPLES+1)/2))p"
    rm -f "$tmpfile"
}

# ─── PART 1: TCP/HTTP Network Benchmarks ───
echo "=== Part 1: TCP/HTTP Benchmarks ==="

# Start servers
zig/echo_server_bin &
PIDS+=($!)
zig/http_server_bin &
PIDS+=($!)

luajit -e "
package.path = '$BASE_DIR/luajit/?.lua;' .. package.path
local srv = require('echo_server')
local fd = srv.create_server($LUAJIT_ECHO_PORT)
io.write('LuaJIT echo on :$LUAJIT_ECHO_PORT\n'); io.flush()
while true do srv.echo_accept_one(fd) end
" &
PIDS+=($!)

luajit -e "
package.path = '$BASE_DIR/luajit/?.lua;' .. package.path
local srv = require('echo_server')
local fd = srv.create_server($LUAJIT_HTTP_PORT)
io.write('LuaJIT HTTP on :$LUAJIT_HTTP_PORT\n'); io.flush()
while true do srv.http_accept_one(fd) end
" &
PIDS+=($!)

quickjs/qjs_echo_server $QJS_ECHO_PORT quickjs/ &
PIDS+=($!)
quickjs/qjs_http_server $QJS_HTTP_PORT quickjs/ &
PIDS+=($!)

sleep 1

# Reduced iteration counts for speed (target <30s per runtime)
NET_RESULTS=""
for runtime_info in "zig:$ZIG_ECHO_PORT" "luajit:$LUAJIT_ECHO_PORT" "quickjs:$QJS_ECHO_PORT"; do
    IFS=':' read -r runtime port <<< "$runtime_info"
    echo "  [$runtime] network benchmarks..."
    result=$(./bench_bin "$runtime" "all" "$port" 2>/dev/null) || result=""
    NET_RESULTS="${NET_RESULTS}${result}"
done

# Kill servers
for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
done
wait 2>/dev/null || true
PIDS=()
sleep 0.5

echo ""

# ─── PART 2: Payload Digestion Benchmarks ───
echo "=== Part 2: Payload Digestion ==="

# Iteration counts per payload size (keep each run <5s)
ITERS_SMALL=2000
ITERS_MEDIUM=500
ITERS_LARGE=20

PAYLOAD_RESULTS=""

for size in small medium large; do
    case $size in
        small)  iters=$ITERS_SMALL ;;
        medium) iters=$ITERS_MEDIUM ;;
        large)  iters=$ITERS_LARGE ;;
    esac

    for func in parse extract validate total serialize; do
        echo "  $size/$func..."

        # Zig
        line=$(median_of "zig/payload_bench_bin payloads/$size.json $func $iters")
        if [ -n "$line" ]; then
            elapsed=$(echo "$line" | cut -f4)
            bridge=$(echo "$line" | cut -f5)
            rss=$(echo "$line" | cut -f6)
            avg=$(echo "scale=1; $elapsed / $iters" | bc 2>/dev/null || echo "?")
            bavg=$(echo "scale=1; $bridge / $iters" | bc 2>/dev/null || echo "0")
            PAYLOAD_RESULTS="${PAYLOAD_RESULTS}| $size | $func | zig | $iters | ${avg} | ${bavg} | $rss |\n"
        fi

        # QuickJS
        line=$(median_of "quickjs/bridge_bench quickjs/payload_bench.js payloads/$size.json $func $iters")
        if [ -n "$line" ]; then
            elapsed=$(echo "$line" | cut -f4)
            bridge=$(echo "$line" | cut -f5)
            rss=$(echo "$line" | cut -f6)
            avg=$(echo "scale=1; $elapsed / $iters" | bc 2>/dev/null || echo "?")
            bavg=$(echo "scale=1; $bridge / $iters" | bc 2>/dev/null || echo "0")
            PAYLOAD_RESULTS="${PAYLOAD_RESULTS}| $size | $func | quickjs | $iters | ${avg} | ${bavg} | $rss |\n"
        fi

        # LuaJIT
        line=$(median_of "luajit luajit/payload_bench.lua payloads/$size.json $func $iters")
        if [ -n "$line" ]; then
            elapsed=$(echo "$line" | cut -f4)
            bridge=$(echo "$line" | cut -f5)
            rss=$(echo "$line" | cut -f6)
            avg=$(echo "scale=1; $elapsed / $iters" | bc 2>/dev/null || echo "?")
            bavg=$(echo "scale=1; $bridge / $iters" | bc 2>/dev/null || echo "0")
            PAYLOAD_RESULTS="${PAYLOAD_RESULTS}| $size | $func | luajit | $iters | ${avg} | ${bavg} | $rss |\n"
        fi
    done
done

echo ""
echo "Writing RESULTS.md..."

# ─── Generate RESULTS.md ───

NET_HEADER="| Test       | Runtime  |    Iters |  Avg (μs) |  P99 (μs) |   Throughput |  RSS KB |"
NET_SEP="|------------|----------|----------|-----------|-----------|--------------|---------|"

cat > "$RESULTS_FILE" << ENDOFRESULTS
# Networking Subsystem Benchmark Results

**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Host:** $(uname -srm)
**Zig:** $(zig version)
**LuaJIT:** $(luajit -v 2>&1 | head -1)
**QuickJS:** quickjs-ng (built from source, -O2)
**Samples:** ${SAMPLES} per test, median reported

---

## Part 1: TCP/HTTP Network Performance

Tests raw socket I/O (echo), HTTP request handling, and connection pool reuse.

$NET_HEADER
$NET_SEP
${NET_RESULTS}

### Hypothesis check: TCP belongs in Zig

TCP echo measures raw socket read/write loop overhead. If Zig dominates here, it confirms TCP-level networking (connection accept, read/write, keepalive, backpressure) should live in Zig where zero-copy and no-GC matter.

---

## Part 2: Payload Digestion

JSON parsing, field extraction, schema validation, and result serialization across 3 payload sizes.

**Bridge Cost** = overhead of passing data across runtime boundaries. For Zig this is 0 (no bridge). For QuickJS this is C→JS string creation + JS→C result extraction. For LuaJIT this is FFI buffer copy in + result copy out.

| Size | Function | Runtime | Iters | Avg (μs) | Bridge (μs) | RSS KB |
|------|----------|---------|-------|----------|-------------|--------|
$(echo -e "$PAYLOAD_RESULTS")

### Hypothesis check: HTTP/JSON belongs in QuickJS?

The supervisor's hypothesis: QuickJS wins on JSON/HTTP ergonomics even if slower on raw sockets. The data above tests this directly:

- **JSON.parse vs std.json**: QuickJS has native \`JSON.parse\` — how does it compare to Zig's \`std.json.parseFromSlice\`?
- **Field extraction**: JS dot notation (\`obj.user.address.city\`) vs Zig's \`object.get("key")\` chain. Performance AND ergonomics.
- **Schema validation**: JS \`typeof\` checks vs Zig tagged union switches.
- **Serialize back**: \`JSON.stringify\` vs manual \`std.fmt.bufPrint\`.

### Bridge tax analysis

The critical question: if TCP lives in Zig but JSON parsing lives in QuickJS, every payload crosses the Zig→JS bridge (string allocation into JS heap) and results cross back (JS→C string extraction or number extraction).

Compare the **Bridge** column to the **Avg** column:
- If bridge ≈ avg: the bridge IS the cost — the runtime split eats all gains.
- If bridge ≈ 2× avg: 50% overhead from bridging. Might be acceptable.
- If bridge >> avg: bridging dominates. Don't split here.

For streaming (Zig reads chunks, hands to QuickJS): multiply per-chunk bridge cost by chunks-per-response. A 1MB response in 64KB chunks = 16 crossings.

---

## Part 3: Where to Draw the Line

Based on the data above:

### TCP Layer → Pure Zig
- Connection accept/close, read/write loops, keepalive, backpressure
- Zero-copy buffer management
- Connection pooling (kernel TCP state management dominates, not runtime)
- **Why:** No GC pauses, no FFI overhead, direct syscall access

### HTTP Parsing → [DATA-DRIVEN DECISION]
- If Zig JSON is within 2× of QuickJS JSON: keep it in Zig (avoid bridge tax)
- If QuickJS JSON is 3×+ faster than Zig JSON: consider splitting (bridge tax may be worth it)
- Header parsing is string-heavy — check if QuickJS string ops justify the bridge

### JSON Payload Processing → [DATA-DRIVEN DECISION]
- Small payloads (<1KB): bridge overhead likely dominates → keep in whichever runtime owns the connection
- Medium payloads (1-100KB): pure processing time dominates → pick the faster parser
- Large payloads (>100KB): GC pressure matters → check RSS column, Zig wins on memory

### Plugin/Extension Networking
- QuickJS for user-facing scripting (route handlers, middleware, API clients)
- Bridge cost is acceptable when the bottleneck is the network, not the runtime
- LuaJIT FFI is the middle ground — near-native speed with scripting ergonomics

---

## Raw Environment

\`\`\`
$(uname -a)
$(cat /proc/cpuinfo | grep "model name" | head -1)
$(free -h | head -2)
\`\`\`
ENDOFRESULTS

echo ""
echo "=== Done ==="
echo "Results: $RESULTS_FILE"
