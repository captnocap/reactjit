// amx/amx.h — vendor stub. We don't compile ggml's AMX backend (Intel
// matrix-extensions for newer Sapphire Rapids / Granite Rapids CPUs).
// ggml-cpu.cpp includes this header unconditionally and calls
// ggml_backend_amx_buffer_type() to optionally register the AMX buffer
// type. Returning NULL → it skips the registration and we get pure
// AVX2/FMA paths everywhere. ggml_cpu_has_amx_int8() is defined in
// ggml-cpu.c and returns 0 on non-AMX CPUs, so no stub needed there.
#pragma once
#include "ggml-backend.h"

static inline ggml_backend_buffer_type_t ggml_backend_amx_buffer_type(void) {
    return NULL;
}
