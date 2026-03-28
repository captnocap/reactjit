// QuickJS C host - embeds QuickJS and exposes POSIX socket bindings to JS
#include "quickjs.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <sys/resource.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <errno.h>

// Native socket functions exposed to JS

static JSValue js_net_create_server(JSContext *ctx, JSValue this_val,
                                     int argc, JSValue *argv) {
    int port;
    if (JS_ToInt32(ctx, &port, argv[0]))
        return JS_EXCEPTION;

    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) return JS_NewInt32(ctx, -1);

    int optval = 1;
    setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &optval, sizeof(optval));

    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

    if (bind(fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        close(fd);
        return JS_NewInt32(ctx, -1);
    }
    if (listen(fd, 128) < 0) {
        close(fd);
        return JS_NewInt32(ctx, -1);
    }
    return JS_NewInt32(ctx, fd);
}

static JSValue js_net_accept(JSContext *ctx, JSValue this_val,
                              int argc, JSValue *argv) {
    int server_fd;
    if (JS_ToInt32(ctx, &server_fd, argv[0]))
        return JS_EXCEPTION;

    struct sockaddr_in client_addr;
    socklen_t addrlen = sizeof(client_addr);
    int client_fd = accept(server_fd, (struct sockaddr*)&client_addr, &addrlen);
    return JS_NewInt32(ctx, client_fd);
}

static JSValue js_net_read(JSContext *ctx, JSValue this_val,
                            int argc, JSValue *argv) {
    int fd, max_bytes;
    if (JS_ToInt32(ctx, &fd, argv[0]))
        return JS_EXCEPTION;
    if (JS_ToInt32(ctx, &max_bytes, argv[1]))
        return JS_EXCEPTION;

    char *buf = malloc(max_bytes);
    if (!buf) return JS_NULL;

    ssize_t n = read(fd, buf, max_bytes);
    if (n <= 0) {
        free(buf);
        return JS_NULL;
    }

    JSValue ret = JS_NewStringLen(ctx, buf, n);
    free(buf);
    return ret;
}

static JSValue js_net_write(JSContext *ctx, JSValue this_val,
                             int argc, JSValue *argv) {
    int fd;
    if (JS_ToInt32(ctx, &fd, argv[0]))
        return JS_EXCEPTION;

    size_t len;
    const char *data = JS_ToCStringLen(ctx, &len, argv[1]);
    if (!data) return JS_EXCEPTION;

    ssize_t total = 0;
    while ((size_t)total < len) {
        ssize_t w = write(fd, data + total, len - total);
        if (w <= 0) break;
        total += w;
    }

    JS_FreeCString(ctx, data);
    return JS_NewInt32(ctx, (int)total);
}

static JSValue js_net_close(JSContext *ctx, JSValue this_val,
                             int argc, JSValue *argv) {
    int fd;
    if (JS_ToInt32(ctx, &fd, argv[0]))
        return JS_EXCEPTION;
    close(fd);
    return JS_UNDEFINED;
}

static JSValue js_net_connect(JSContext *ctx, JSValue this_val,
                               int argc, JSValue *argv) {
    int port;
    if (JS_ToInt32(ctx, &port, argv[0]))
        return JS_EXCEPTION;

    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) return JS_NewInt32(ctx, -1);

    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

    if (connect(fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        close(fd);
        return JS_NewInt32(ctx, -1);
    }
    return JS_NewInt32(ctx, fd);
}

static JSValue js_get_time_us(JSContext *ctx, JSValue this_val,
                               int argc, JSValue *argv) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return JS_NewFloat64(ctx, (double)tv.tv_sec * 1000000.0 + (double)tv.tv_usec);
}

static JSValue js_get_rss_kb(JSContext *ctx, JSValue this_val,
                              int argc, JSValue *argv) {
    struct rusage usage;
    getrusage(RUSAGE_SELF, &usage);
    return JS_NewInt64(ctx, usage.ru_maxrss);
}

static void register_native_functions(JSContext *ctx) {
    JSValue global = JS_GetGlobalObject(ctx);

    JS_SetPropertyStr(ctx, global, "net_create_server",
        JS_NewCFunction(ctx, js_net_create_server, "net_create_server", 1));
    JS_SetPropertyStr(ctx, global, "net_accept",
        JS_NewCFunction(ctx, js_net_accept, "net_accept", 1));
    JS_SetPropertyStr(ctx, global, "net_read",
        JS_NewCFunction(ctx, js_net_read, "net_read", 2));
    JS_SetPropertyStr(ctx, global, "net_write",
        JS_NewCFunction(ctx, js_net_write, "net_write", 2));
    JS_SetPropertyStr(ctx, global, "net_close",
        JS_NewCFunction(ctx, js_net_close, "net_close", 1));
    JS_SetPropertyStr(ctx, global, "net_connect",
        JS_NewCFunction(ctx, js_net_connect, "net_connect", 1));
    JS_SetPropertyStr(ctx, global, "get_time_us",
        JS_NewCFunction(ctx, js_get_time_us, "get_time_us", 0));
    JS_SetPropertyStr(ctx, global, "get_rss_kb",
        JS_NewCFunction(ctx, js_get_rss_kb, "get_rss_kb", 0));

    JS_FreeValue(ctx, global);
}

// Public API for the benchmark harness
JSRuntime *qjs_rt = NULL;
JSContext *qjs_ctx = NULL;

int qjs_init(const char *script_path) {
    qjs_rt = JS_NewRuntime();
    if (!qjs_rt) return -1;

    qjs_ctx = JS_NewContext(qjs_rt);
    if (!qjs_ctx) return -1;

    register_native_functions(qjs_ctx);

    // Load and evaluate the JS file
    FILE *f = fopen(script_path, "rb");
    if (!f) {
        fprintf(stderr, "Cannot open %s\n", script_path);
        return -1;
    }
    fseek(f, 0, SEEK_END);
    long len = ftell(f);
    fseek(f, 0, SEEK_SET);
    char *buf = malloc(len + 1);
    fread(buf, 1, len, f);
    buf[len] = '\0';
    fclose(f);

    JSValue result = JS_Eval(qjs_ctx, buf, len, script_path, JS_EVAL_TYPE_GLOBAL);
    free(buf);

    if (JS_IsException(result)) {
        JSValue exc = JS_GetException(qjs_ctx);
        const char *str = JS_ToCString(qjs_ctx, exc);
        fprintf(stderr, "QuickJS eval error: %s\n", str ? str : "(null)");
        if (str) JS_FreeCString(qjs_ctx, str);
        JS_FreeValue(qjs_ctx, exc);
        JS_FreeValue(qjs_ctx, result);
        return -1;
    }
    JS_FreeValue(qjs_ctx, result);
    return 0;
}

int qjs_call_echo_accept(int server_fd) {
    JSValue global = JS_GetGlobalObject(qjs_ctx);
    JSValue func = JS_GetPropertyStr(qjs_ctx, global, "echo_accept_one");

    JSValue arg = JS_NewInt32(qjs_ctx, server_fd);
    JSValue ret = JS_Call(qjs_ctx, func, global, 1, &arg);

    int result = 0;
    if (JS_IsBool(ret)) {
        result = JS_ToBool(qjs_ctx, ret);
    }

    JS_FreeValue(qjs_ctx, ret);
    JS_FreeValue(qjs_ctx, arg);
    JS_FreeValue(qjs_ctx, func);
    JS_FreeValue(qjs_ctx, global);
    return result;
}

int qjs_call_http_accept(int server_fd) {
    JSValue global = JS_GetGlobalObject(qjs_ctx);
    JSValue func = JS_GetPropertyStr(qjs_ctx, global, "http_accept_one");

    JSValue arg = JS_NewInt32(qjs_ctx, server_fd);
    JSValue ret = JS_Call(qjs_ctx, func, global, 1, &arg);

    int result = 0;
    if (JS_IsBool(ret)) {
        result = JS_ToBool(qjs_ctx, ret);
    }

    JS_FreeValue(qjs_ctx, ret);
    JS_FreeValue(qjs_ctx, arg);
    JS_FreeValue(qjs_ctx, func);
    JS_FreeValue(qjs_ctx, global);
    return result;
}

void qjs_cleanup(void) {
    if (qjs_ctx) JS_FreeContext(qjs_ctx);
    if (qjs_rt) JS_FreeRuntime(qjs_rt);
    qjs_ctx = NULL;
    qjs_rt = NULL;
}
