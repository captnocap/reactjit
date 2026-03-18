#include <time.h>

// Global N — can be changed at runtime from JS or Zig
static long g_compute_n = 100000;

long heavy_compute(long n) {
    long iters = (n > 0) ? n : g_compute_n;
    long sum = 0;
    for (long i = 0; i < iters; i++) {
        sum += i * i;
    }
    return sum % 1000000;
}

long heavy_compute_timed(long n) {
    long iters = (n > 0) ? n : g_compute_n;
    struct timespec t0, t1;
    clock_gettime(CLOCK_MONOTONIC, &t0);
    volatile long sum = 0;
    for (long i = 0; i < iters; i++) {
        sum += i * i;
    }
    clock_gettime(CLOCK_MONOTONIC, &t1);
    return (t1.tv_sec - t0.tv_sec) * 1000000 + (t1.tv_nsec - t0.tv_nsec) / 1000;
}

// Set the global N from JS or Zig
void set_compute_n(long n) {
    g_compute_n = n;
}

// Batch: call heavy_compute(iters_per_call) call_count times
// Returns elapsed microseconds. Same total work as N individual calls
// but done in a single C function — no bridge re-entry.
long heavy_compute_batch(long call_count) {
    long calls = (call_count > 0) ? call_count : g_compute_n;
    struct timespec t0, t1;
    clock_gettime(CLOCK_MONOTONIC, &t0);
    volatile long res = 0;
    for (long c = 0; c < calls; c++) {
        res = heavy_compute(100);
    }
    clock_gettime(CLOCK_MONOTONIC, &t1);
    return (t1.tv_sec - t0.tv_sec) * 1000000 + (t1.tv_nsec - t0.tv_nsec) / 1000;
}

// Same but returns the last result instead of time
long heavy_compute_batch_result(long call_count) {
    long calls = (call_count > 0) ? call_count : g_compute_n;
    volatile long res = 0;
    for (long c = 0; c < calls; c++) {
        res = heavy_compute(100);
    }
    return res;
}
