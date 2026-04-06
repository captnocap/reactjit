// ── Log Dictionary ──
// Every log entry in the system is registered here with an ID, category,
// and format string. Nothing prints unless it is registered.
// Use: LOG_EMIT('L002', { count: 3, maps: 2 })
// CLI: --logs (all) or --logs=find:keyword (filtered)

var LOG = {
  // ── Forge/Lex ──
  L001: { cat: 'forge:lex',       fmt: 'tokenized {count} tokens from {file}' },
  L002: { cat: 'smith:parse',     fmt: 'collected {count} components, {maps} maps' },
  L003: { cat: 'smith:emit',      fmt: 'generated {bytes} bytes' },
  L004: { cat: 'smith:compile',   fmt: 'compile complete for {file}' },

  // ── Handlers ──
  L010: { cat: 'handler:fire',    fmt: '{name} at map{mi} item {i}' },
  L011: { cat: 'handler:wire',    fmt: 'wired {name} to node {nodeId}' },
  L012: { cat: 'handler:empty',   fmt: '{name} has empty body' },
  L013: { cat: 'handler:script',  fmt: '{name} dispatches to script func {func}' },

  // ── Maps ──
  L020: { cat: 'map:rebuild',     fmt: 'map{mi} count={count}' },
  L021: { cat: 'map:pool',        fmt: 'map{mi} pool allocated {size} nodes' },
  L022: { cat: 'map:nested',      fmt: 'map{mi} nested under map{parent}' },
  L023: { cat: 'map:inline',      fmt: 'map{mi} inline (separate OA) inside map{parent}' },
  L024: { cat: 'map:detect',      fmt: 'detected .map() call on {name}' },

  // ── Dynamic text ──
  L030: { cat: 'dynText:update',  fmt: 'buf{id} = "{value}"' },
  L031: { cat: 'dynText:create',  fmt: 'buf{id} fmt="{fmtString}" args={args}' },
  L032: { cat: 'dynText:map',     fmt: 'map buf{id} in map{mi} fmt="{fmtString}"' },

  // ── State ──
  L040: { cat: 'state:set',       fmt: 'slot {slot} = {value}' },
  L041: { cat: 'state:init',      fmt: 'initialized {count} slots' },
  L042: { cat: 'state:collect',   fmt: 'found {getter}/{setter} type={type} initial={initial}' },

  // ── Layout issues ──
  L050: { cat: 'layout:warn',     fmt: 'negative_size: node {id} has {dim}={val}' },
  L051: { cat: 'layout:warn',     fmt: 'oversized_elements: node {id} {dim}={val} exceeds parent' },
  L052: { cat: 'layout:warn',     fmt: 'zero_size: node {id} has zero {dim}' },

  // ── Colors ──
  L060: { cat: 'color:resolve',   fmt: '{field} resolved {from} to {to}' },
  L061: { cat: 'color:orphan',    fmt: '{field}={value} has no dynStyle backing' },

  // ── Components ──
  L070: { cat: 'component:inline', fmt: 'inlining {name} at pos {pos}' },
  L071: { cat: 'component:props',  fmt: '{name} receives props: {props}' },
  L072: { cat: 'component:state',  fmt: '{name} instance gets slots {from}-{to}' },

  // ── Conditionals ──
  L080: { cat: 'cond:show_hide',  fmt: 'conditional {idx} expr="{expr}"' },
  L081: { cat: 'cond:ternary',    fmt: 'ternary {idx} expr="{expr}"' },

  // ── Preflight ──
  L090: { cat: 'preflight:fatal', fmt: '{id}: {msg}' },
  L091: { cat: 'preflight:warn',  fmt: '{id}: {msg}' },
  L092: { cat: 'preflight:lane',  fmt: 'lane={lane} intents={summary}' },

  // ── Classifiers ──
  L100: { cat: 'cls:resolve',     fmt: 'C.{name} resolved to {type}' },
  L101: { cat: 'cls:merge',       fmt: 'C.{name} merged {count} style fields' },
};

// ── LOG_EMIT — structured log output ──
// Checks __SMITH_LOGS and __SMITH_LOGS_FIND filter before printing.
// Format: [ID:category] interpolated message
function LOG_EMIT(id, data) {
  if (!globalThis.__SMITH_LOGS && !globalThis.__SMITH_LOGS_FIND) return;
  var entry = LOG[id];
  if (!entry) return;

  // Filter check: if --logs=find:keyword, only emit matching entries
  if (globalThis.__SMITH_LOGS_FIND) {
    var q = globalThis.__SMITH_LOGS_FIND.toLowerCase();
    var haystack = (id + ' ' + entry.cat + ' ' + entry.fmt).toLowerCase();
    if (haystack.indexOf(q) < 0) return;
  }

  // Interpolate format string with data
  var msg = entry.fmt;
  if (data) {
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      msg = msg.replace('{' + keys[i] + '}', String(data[keys[i]]));
    }
  }

  // Route through __dbg — appears as Zig comments in generated output.
  // (QuickJS has no print() in this context; future: add native bridge for stderr)
  if (!globalThis.__dbg) globalThis.__dbg = [];
  globalThis.__dbg.push('[' + id + ':' + entry.cat + '] ' + msg);
}

// ── print shim ──
// QuickJS doesn't expose print() in forge's context. Route to __dbg so
// legacy debug paths (print(...) in index.js) don't crash.
if (typeof globalThis.print === 'undefined') {
  globalThis.print = function(msg) {
    if (!globalThis.__dbg) globalThis.__dbg = [];
    globalThis.__dbg.push(String(msg));
  };
}

// ── Legacy flag bridge ──
// --logs activates ALL debug paths. Old scattered flags are aliased here
// so existing __SMITH_DEBUG_* checks throughout smith files still fire.
// This is a migration bridge — as individual checks get replaced with
// LOG_EMIT calls, these aliases can be removed one by one.
if (globalThis.__SMITH_LOGS) {
  globalThis.__SMITH_DEBUG = 1;
  globalThis.__SMITH_DEBUG_INLINE = 1;
  globalThis.__SMITH_DEBUG_MAP_TEXT = 1;
  globalThis.__SMITH_DEBUG_MAP_DETECT = 1;
  globalThis.__SMITH_DEBUG_MAP_PTRS = 1;
}
