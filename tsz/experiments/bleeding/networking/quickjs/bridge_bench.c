// QuickJS bridge benchmark - measures JSON parsing and Zig↔JS data transfer cost
// Standalone binary: takes a command and JSON payload on stdin, outputs timing
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
    if (fread(buf, 1, len, f) != (size_t)len) { free(buf); fclose(f); return NULL; }
    buf[len] = '\0';
    fclose(f);
    return buf;
}

// Read payload from file
static char *read_payload(const char *path) {
    return read_file(path);
}

int main(int argc, char **argv) {
    if (argc < 5) {
        fprintf(stderr, "Usage: bridge_bench <script.js> <payload_file> <function> <iterations>\n");
        fprintf(stderr, "  function: parse|extract|validate|total|serialize\n");
        return 1;
    }

    const char *script_path = argv[1];
    const char *payload_path = argv[2];
    const char *func_name_arg = argv[3];
    int iterations = atoi(argv[4]);

    // Map short names to JS function names
    const char *func_name;
    if (strcmp(func_name_arg, "parse") == 0) func_name = "parse_json";
    else if (strcmp(func_name_arg, "extract") == 0) func_name = "extract_fields";
    else if (strcmp(func_name_arg, "validate") == 0) func_name = "validate_schema";
    else if (strcmp(func_name_arg, "total") == 0) func_name = "parse_and_return_total";
    else if (strcmp(func_name_arg, "serialize") == 0) func_name = "parse_extract_serialize";
    else { fprintf(stderr, "Unknown function: %s\n", func_name_arg); return 1; }

    char *script = read_file(script_path);
    if (!script) { fprintf(stderr, "Cannot read %s\n", script_path); return 1; }

    char *payload = read_payload(payload_path);
    if (!payload) { fprintf(stderr, "Cannot read %s\n", payload_path); return 1; }
    long payload_len = strlen(payload);

    // Init QuickJS
    JSRuntime *rt = JS_NewRuntime();
    JSContext *ctx = JS_NewContext(rt);

    JSValue result = JS_Eval(ctx, script, strlen(script), script_path, JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(result)) {
        JSValue exc = JS_GetException(ctx);
        const char *s = JS_ToCString(ctx, exc);
        fprintf(stderr, "JS error: %s\n", s ? s : "(null)");
        if (s) JS_FreeCString(ctx, s);
        JS_FreeValue(ctx, exc);
        JS_FreeValue(ctx, result);
        return 1;
    }
    JS_FreeValue(ctx, result);

    // Get the function
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue func = JS_GetPropertyStr(ctx, global, func_name);
    if (!JS_IsFunction(ctx, func)) {
        fprintf(stderr, "Not a function: %s\n", func_name);
        return 1;
    }

    // Pre-create the JS string for the payload
    JSValue js_payload = JS_NewStringLen(ctx, payload, payload_len);

    // Warmup (10% of iterations, min 10)
    int warmup = iterations / 10;
    if (warmup < 10) warmup = 10;
    for (int i = 0; i < warmup; i++) {
        JSValue r = JS_Call(ctx, func, global, 1, &js_payload);
        JS_FreeValue(ctx, r);
    }

    // Benchmark
    long rss_before = get_rss_kb();
    long long start = get_time_us();

    for (int i = 0; i < iterations; i++) {
        JSValue r = JS_Call(ctx, func, global, 1, &js_payload);
        JS_FreeValue(ctx, r);
    }

    long long elapsed = get_time_us() - start;
    long rss_after = get_rss_kb();

    // Bridge cost test: measure the cost of passing data IN and getting result OUT
    // Create fresh string each iteration to measure the string crossing cost
    long long bridge_start = get_time_us();
    for (int i = 0; i < iterations; i++) {
        // Simulate Zig→JS: create JS string from C buffer (this is the bridge IN cost)
        JSValue fresh_payload = JS_NewStringLen(ctx, payload, payload_len);
        JSValue r = JS_Call(ctx, func, global, 1, &fresh_payload);
        // Simulate JS→Zig: extract result back to C string (bridge OUT cost)
        if (JS_IsString(r)) {
            const char *s = JS_ToCString(ctx, r);
            if (s) JS_FreeCString(ctx, s);
        } else if (JS_IsNumber(r)) {
            double d;
            JS_ToFloat64(ctx, &d, r);
            (void)d;
        }
        JS_FreeValue(ctx, r);
        JS_FreeValue(ctx, fresh_payload);
    }
    long long bridge_elapsed = get_time_us() - bridge_start;

    // Output: func payload_size iters elapsed_us bridge_us rss_kb
    // (avg per-op computed by the harness)
    printf("%s\t%ld\t%d\t%lld\t%lld\t%ld\n",
           func_name_arg, payload_len, iterations,
           elapsed, bridge_elapsed,
           rss_after > rss_before ? rss_after : rss_before);

    JS_FreeValue(ctx, js_payload);
    JS_FreeValue(ctx, func);
    JS_FreeValue(ctx, global);
    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    free(script);
    free(payload);
    return 0;
}
