// EventLog — observability bus tail.
//
// Standalone-cart wrapper around the runtime EventLog component. The
// component itself lives in runtime/devEventLog.tsx so the runtime can
// also wrap every dev-mode cart with a sibling Window that renders this
// same view; here we just re-export the default.
//
// To ship eventlog as a regular cart:
//   ./scripts/ship eventlog

export { default } from '@reactjit/runtime/devEventLog';
