// Tiny shim that fills in a zig-v8 binding missing from the prebuilt
// libc_v8.a. We can't easily rebuild that .a and we don't have V8 headers
// checked in. But the V8 method we need IS already a defined symbol in the
// prebuilt (verified with nm), so we just declare its mangled name and call
// it. C++ Itanium ABI is stable on Linux/macOS x86_64.
//
// Provides: v8__Isolate__SetStackLimit  (extern "C" wrapper)
//
// Why we need it: see framework/v8_runtime.zig initVM — the full story
// lives there. Short version: V8 14's default ~700KB per-isolate stack
// budget can't survive our 1MB+ bundle parse, V8 throws StackOverflow,
// and inside the throw V8 14 trips an IsOnCentralStack invariant whose
// error message ("Check failed: IsOnCentralStack()") sent multiple prior
// debugging sessions chasing phantom binding-tickDrain bugs. Real fix is
// here: hand V8 a bigger stack window via SetStackLimit.

#include <stddef.h>
#include <stdint.h>

// Forward-declare the mangled symbol. v8::Isolate is incomplete here — we
// just pass an opaque pointer through. Mangled name from libc_v8.a:
//   _ZN2v87Isolate13SetStackLimitEm  (v8::Isolate::SetStackLimit(uintptr_t))
namespace v8 {
class Isolate;
}
extern "C" void _ZN2v87Isolate13SetStackLimitEm(v8::Isolate*, uintptr_t);

extern "C" void v8__Isolate__SetStackLimit(v8::Isolate* self, uintptr_t limit) {
    _ZN2v87Isolate13SetStackLimitEm(self, limit);
}
