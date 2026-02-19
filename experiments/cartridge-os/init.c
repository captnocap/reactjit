/*
 * CartridgeOS init.c — PID 1
 * Static musl binary. Loads virtio-gpu module, then runs luajit as a child.
 * Running luajit as a child (not exec'd) means a crash drops to shell
 * instead of causing a kernel panic.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/mount.h>
#include <sys/stat.h>
#include <sys/wait.h>

static void run_wait(char *const argv[]) {
    pid_t pid = fork();
    if (pid == 0) { execv(argv[0], argv); _exit(1); }
    if (pid > 0)  waitpid(pid, NULL, 0);
}

int main(void) {
    /* ── Filesystems ─────────────────────────────────────────────────────── */
    mount("proc",     "/proc", "proc",     0, NULL);
    mount("sysfs",    "/sys",  "sysfs",    0, NULL);
    mount("devtmpfs", "/dev",  "devtmpfs", 0, NULL);

    int pfd = open("/proc/sys/kernel/printk", O_WRONLY);
    if (pfd >= 0) { write(pfd, "1\n", 2); close(pfd); }

    int con = open("/dev/console", O_RDWR);
    if (con >= 0) { dup2(con, 0); dup2(con, 1); dup2(con, 2); if (con > 2) close(con); }

    /* ── Install busybox applets (cat, ls, modprobe, etc.) ────────────────── */
    char *bb[] = { "/bin/busybox", "--install", "-s", "/bin", NULL };
    run_wait(bb);

    /* ── Banner ──────────────────────────────────────────────────────────── */
    puts("\n  CartridgeOS v0.1");
    puts("  iLoveReact  --  no X11, no Wayland, no display server");

    char ver[64] = "unknown";
    FILE *vf = fopen("/proc/version", "r");
    if (vf) {
        char line[512]; char *tok;
        if (fgets(line, sizeof(line), vf)) {
            tok = strtok(line, " "); tok = strtok(NULL, " "); tok = strtok(NULL, " ");
            if (tok) strncpy(ver, tok, sizeof(ver)-1);
        }
        fclose(vf);
    }
    printf("  kernel: %s\n\n", ver);

    /* ── Load virtio-gpu module ───────────────────────────────────────────── */
    puts("  Loading virtio-gpu driver...");
    fflush(stdout);
    char *modargs[] = { "/bin/busybox", "modprobe", "virtio-gpu", NULL };
    run_wait(modargs);
    usleep(1500000);  /* wait for DRM device enumeration */

    if (access("/dev/dri/card0", F_OK) == 0)
        puts("  DRM: /dev/dri/card0 ready");
    else
        puts("  WARNING: /dev/dri/card0 missing");
    if (access("/dev/dri/renderD128", F_OK) == 0)
        puts("  DRM: /dev/dri/renderD128 ready");
    else
        puts("  DRM: /dev/dri/renderD128 not found (EGL render node)");

    /* Sanity check: confirm we have virtio-gpu (1af4:1050), not stdvga (1234:1111) */
    puts("  GPU PCI:");
    char *gpucheck[] = { "/bin/sh", "-c",
        "for d in /sys/bus/pci/devices/*; do "
        "  if [ -f \"$d/class\" ] && grep -q '^0x030' \"$d/class\"; then "
        "    printf '    %s vendor=%s device=%s\\n' "
        "      \"$(basename $d)\" \"$(cat $d/vendor)\" \"$(cat $d/device)\"; "
        "  fi; "
        "done", NULL };
    run_wait(gpucheck);
    fflush(stdout);

    /* ── Environment ─────────────────────────────────────────────────────── */
    setenv("SDL_VIDEODRIVER",    "kmsdrm",            1);
    setenv("LD_LIBRARY_PATH",    "/app:/usr/lib:/lib", 1);
    setenv("LIBGL_DRIVERS_PATH", "/usr/lib/xorg/modules/dri", 1);
    setenv("LIBGL_DRIVERS_DIR",  "/usr/lib/xorg/modules/dri", 1);
    setenv("EGL_PLATFORM",       "gbm",               1);
    setenv("MESA_EGL_NO_X11",    "1",                 1);
    setenv("MESA_LOADER_DRIVER_OVERRIDE", "virtio_gpu", 1);
    /* SDL2's KMSDRM backend hardcodes GBM_FORMAT_ARGB8888 for scanout
     * surfaces. virtio-gpu only supports XRGB8888 for drmModeSetCrtc.
     * This shim intercepts gbm_surface_create and swaps the format. */
    setenv("LD_PRELOAD",  "/app/gbm_format_shim.so",  1);

    /* ── Launch luajit as child (not exec — so crash = shell, not panic) ─── */
    puts("  Launching iLoveReact...\n");
    fflush(stdout);

    pid_t app = fork();
    if (app == 0) {
        /* child */
        char *argv[] = { "/usr/bin/luajit", "/app/main.lua", NULL };
        execv("/usr/bin/luajit", argv);
        fprintf(stderr, "[init] execv luajit: %s\n", strerror(errno));
        _exit(1);
    }

    if (app > 0) {
        int status;
        waitpid(app, &status, 0);
        if (WIFEXITED(status))
            printf("\n  [init] app exited (code %d)\n", WEXITSTATUS(status));
        else if (WIFSIGNALED(status))
            printf("\n  [init] app killed by signal %d\n", WTERMSIG(status));
        else
            printf("\n  [init] app stopped (raw status %d)\n", status);
    } else {
        fprintf(stderr, "[init] fork failed: %s\n", strerror(errno));
    }

    /* ── Fallback shell ──────────────────────────────────────────────────── */
    puts("\n  [init] dropping to shell (Ctrl-D to reboot)\n");
    fflush(stdout);
    char *sh[] = { "/bin/sh", NULL };
    execv("/bin/sh", sh);

    /* Should never reach here — PID 1 must not exit */
    while (1) sleep(1);
    return 0;
}
