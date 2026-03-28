// Standalone server binary for QuickJS echo/http
// Compile with -DSERVER_MODE=1 for echo, -DSERVER_MODE=2 for http
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <string.h>
#include <libgen.h>

// From host.c
extern int qjs_init(const char *script_path);
extern int qjs_call_echo_accept(int server_fd);
extern int qjs_call_http_accept(int server_fd);
extern void qjs_cleanup(void);

// We also need the native socket create function
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>

static volatile int running = 1;

static void handle_signal(int sig) {
    (void)sig;
    running = 0;
}

static int create_server(int port) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) return -1;

    int optval = 1;
    setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &optval, sizeof(optval));

    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

    if (bind(fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        close(fd);
        return -1;
    }
    if (listen(fd, 128) < 0) {
        close(fd);
        return -1;
    }
    return fd;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <port> [script_dir]\n", argv[0]);
        return 1;
    }

    int port = atoi(argv[1]);
    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);

    // Find the JS script - look relative to binary or in provided dir
    char script_path[1024];
    if (argc >= 3) {
        snprintf(script_path, sizeof(script_path), "%s/echo_server.js", argv[2]);
    } else {
        // Try relative to the binary
        char *bin_dir = dirname(strdup(argv[0]));
        snprintf(script_path, sizeof(script_path), "%s/echo_server.js", bin_dir);
    }

    if (qjs_init(script_path) != 0) {
        fprintf(stderr, "Failed to initialize QuickJS\n");
        return 1;
    }

    int server_fd = create_server(port);
    if (server_fd < 0) {
        fprintf(stderr, "Failed to create server on port %d\n", port);
        qjs_cleanup();
        return 1;
    }

#if SERVER_MODE == 1
    fprintf(stderr, "QuickJS echo server on :%d\n", port);
    while (running) {
        qjs_call_echo_accept(server_fd);
    }
#elif SERVER_MODE == 2
    fprintf(stderr, "QuickJS HTTP server on :%d\n", port);
    while (running) {
        qjs_call_http_accept(server_fd);
    }
#else
    #error "Define SERVER_MODE=1 (echo) or SERVER_MODE=2 (http)"
#endif

    close(server_fd);
    qjs_cleanup();
    return 0;
}
