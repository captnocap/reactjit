// Heavy compute function for benchmarking
// If n > 0, uses n. If n == 0, uses internal g_compute_n (default 100000).
long heavy_compute(long n);

// Same but returns elapsed microseconds instead of result
long heavy_compute_timed(long n);

// Set the internal iteration count
void set_compute_n(long n);

// Batch: call heavy_compute(100) call_count times in C. Returns elapsed us.
long heavy_compute_batch(long call_count);

// Same but returns last result
long heavy_compute_batch_result(long call_count);
