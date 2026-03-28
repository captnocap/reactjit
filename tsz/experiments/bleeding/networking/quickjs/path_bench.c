// Path benchmark — measures the actual data flow options for getting HTTP
// response data from the wire into a usable JS object in QuickJS.
//
// Path A (love2d current): raw_bytes → Lua json.decode → Lua json.encode → JS_NewString → JSON.parse
//   Simulated as: C parses JSON to extract fields, re-serializes, passes string to QJS, QJS parses again
//   We approximate this with: JSON.parse twice (parse + stringify + parse)
//
// Path B (direct): raw_bytes → JS_NewStringLen → JSON.parse → done
//   One copy, one parse. The optimal path.
//
// Path C (direct + extract): raw_bytes → JS_NewStringLen → JSON.parse → field access → return scalar
//   Like B but also measures how fast QJS can extract fields after parse
//
// Path D (direct + extract + bridge out): Like C but serializes result back to C string
//   Full round-trip: bytes in, parse, extract, result out

#include "quickjs.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>
#include <sys/resource.h>

static long long get_time_us(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (long long)tv.tv_sec * 1000000LL + tv.tv_usec;
}

static long get_rss_kb(void) {
    struct rusage usage;
    getrusage(RUSAGE_SELF, &usage);
    return usage.ru_maxrss;
}

static char *read_file(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long len = ftell(f);
    fseek(f, 0, SEEK_SET);
    char *buf = malloc(len + 1);
    if ((long)fread(buf, 1, len, f) != len) { free(buf); fclose(f); return NULL; }
    buf[len] = '\0';
    fclose(f);
    return buf;
}

// Eval a JS expression and return the result
static JSValue eval_js(JSContext *ctx, const char *code) {
    return JS_Eval(ctx, code, strlen(code), "<bench>", JS_EVAL_TYPE_GLOBAL);
}

int main(int argc, char **argv) {
    if (argc < 3) {
        fprintf(stderr, "Usage: path_bench <payload_file> <iterations>\n");
        return 1;
    }

    char *payload = read_file(argv[1]);
    if (!payload) { fprintf(stderr, "Cannot read %s\n", argv[1]); return 1; }
    long payload_len = strlen(payload);
    int iters = atoi(argv[2]);

    JSRuntime *rt = JS_NewRuntime();
    JSContext *ctx = JS_NewContext(rt);

    // Install helper functions
    const char *setup =
        "function pathA_double_parse(raw) {\n"
        "  // Simulate: Lua decoded it, re-encoded it, we parse that\n"
        "  var obj = JSON.parse(raw);\n"
        "  var reencoded = JSON.stringify(obj);\n"
        "  return JSON.parse(reencoded);\n"
        "}\n"
        "function pathB_direct(raw) {\n"
        "  return JSON.parse(raw);\n"
        "}\n"
        "function pathC_extract(raw) {\n"
        "  var obj = JSON.parse(raw);\n"
        "  var total = 0;\n"
        "  if (obj.items) {\n"
        "    for (var i = 0; i < obj.items.length; i++) total += obj.items[i].price;\n"
        "  }\n"
        "  return { user: obj.user ? obj.user.name : '', count: obj.items ? obj.items.length : 0, total: total };\n"
        "}\n"
        "function pathD_roundtrip(raw) {\n"
        "  var obj = JSON.parse(raw);\n"
        "  var total = 0;\n"
        "  if (obj.items) {\n"
        "    for (var i = 0; i < obj.items.length; i++) total += obj.items[i].price;\n"
        "  }\n"
        "  return JSON.stringify({ user: obj.user ? obj.user.name : '', count: obj.items ? obj.items.length : 0, total: total });\n"
        "}\n";

    JSValue r = JS_Eval(ctx, setup, strlen(setup), "<setup>", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(r)) {
        JSValue exc = JS_GetException(ctx);
        const char *s = JS_ToCString(ctx, exc);
        fprintf(stderr, "Setup error: %s\n", s ? s : "?");
        if (s) JS_FreeCString(ctx, s);
        JS_FreeValue(ctx, exc);
    }
    JS_FreeValue(ctx, r);

    JSValue global = JS_GetGlobalObject(ctx);

    // Get function handles
    JSValue fnA = JS_GetPropertyStr(ctx, global, "pathA_double_parse");
    JSValue fnB = JS_GetPropertyStr(ctx, global, "pathB_direct");
    JSValue fnC = JS_GetPropertyStr(ctx, global, "pathC_extract");
    JSValue fnD = JS_GetPropertyStr(ctx, global, "pathD_roundtrip");

    // Warmup all paths
    int warmup = iters / 10;
    if (warmup < 5) warmup = 5;
    for (int i = 0; i < warmup; i++) {
        JSValue s = JS_NewStringLen(ctx, payload, payload_len);
        JSValue ra = JS_Call(ctx, fnA, global, 1, &s); JS_FreeValue(ctx, ra);
        JSValue rb = JS_Call(ctx, fnB, global, 1, &s); JS_FreeValue(ctx, rb);
        JSValue rc = JS_Call(ctx, fnC, global, 1, &s); JS_FreeValue(ctx, rc);
        JSValue rd = JS_Call(ctx, fnD, global, 1, &s); JS_FreeValue(ctx, rd);
        JS_FreeValue(ctx, s);
    }

    printf("payload: %ld bytes, iters: %d\n", payload_len, iters);
    printf("%-25s %10s %10s %10s\n", "Path", "Total μs", "Avg μs", "RSS KB");
    printf("%-25s %10s %10s %10s\n", "-------------------------", "----------", "----------", "----------");

    // ── Path A: double parse (love2d current) ──
    {
        long long start = get_time_us();
        for (int i = 0; i < iters; i++) {
            JSValue s = JS_NewStringLen(ctx, payload, payload_len);
            JSValue res = JS_Call(ctx, fnA, global, 1, &s);
            JS_FreeValue(ctx, res);
            JS_FreeValue(ctx, s);
        }
        long long elapsed = get_time_us() - start;
        printf("%-25s %10lld %10.1f %10ld\n", "A: double parse", elapsed, (double)elapsed / iters, get_rss_kb());
    }

    // ── Path B: direct parse ──
    {
        long long start = get_time_us();
        for (int i = 0; i < iters; i++) {
            JSValue s = JS_NewStringLen(ctx, payload, payload_len);
            JSValue res = JS_Call(ctx, fnB, global, 1, &s);
            JS_FreeValue(ctx, res);
            JS_FreeValue(ctx, s);
        }
        long long elapsed = get_time_us() - start;
        printf("%-25s %10lld %10.1f %10ld\n", "B: direct parse", elapsed, (double)elapsed / iters, get_rss_kb());
    }

    // ── Path C: direct + extract fields ──
    {
        long long start = get_time_us();
        for (int i = 0; i < iters; i++) {
            JSValue s = JS_NewStringLen(ctx, payload, payload_len);
            JSValue res = JS_Call(ctx, fnC, global, 1, &s);
            JS_FreeValue(ctx, res);
            JS_FreeValue(ctx, s);
        }
        long long elapsed = get_time_us() - start;
        printf("%-25s %10lld %10.1f %10ld\n", "C: parse + extract", elapsed, (double)elapsed / iters, get_rss_kb());
    }

    // ── Path D: full round-trip (parse + extract + serialize out) ──
    {
        long long start = get_time_us();
        for (int i = 0; i < iters; i++) {
            JSValue s = JS_NewStringLen(ctx, payload, payload_len);
            JSValue res = JS_Call(ctx, fnD, global, 1, &s);
            // Simulate extracting the result back to C
            if (JS_IsString(res)) {
                const char *out = JS_ToCString(ctx, res);
                if (out) JS_FreeCString(ctx, out);
            }
            JS_FreeValue(ctx, res);
            JS_FreeValue(ctx, s);
        }
        long long elapsed = get_time_us() - start;
        printf("%-25s %10lld %10.1f %10ld\n", "D: full round-trip", elapsed, (double)elapsed / iters, get_rss_kb());
    }

    // ── Path E: string copy only (baseline — just the bridge-in cost) ──
    {
        long long start = get_time_us();
        for (int i = 0; i < iters; i++) {
            JSValue s = JS_NewStringLen(ctx, payload, payload_len);
            JS_FreeValue(ctx, s);
        }
        long long elapsed = get_time_us() - start;
        printf("%-25s %10lld %10.1f %10ld\n", "E: string copy only", elapsed, (double)elapsed / iters, get_rss_kb());
    }

    JS_FreeValue(ctx, fnA);
    JS_FreeValue(ctx, fnB);
    JS_FreeValue(ctx, fnC);
    JS_FreeValue(ctx, fnD);
    JS_FreeValue(ctx, global);
    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    free(payload);
    return 0;
}
