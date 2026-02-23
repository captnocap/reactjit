/**
 * bridge.js — Browser-side bridge for love.js WASM builds
 *
 * Mirrors bridge_fs.lua: polls __bridge_out.json from window.Module.FS each frame,
 * dispatches events to React, and writes React commands to __bridge_in.json.
 *
 * Protocol:
 *   Lua -> JS:  Lua writes __bridge_out.json via love.filesystem, JS reads via window.Module.FS
 *   JS -> Lua:  JS writes __bridge_in.json via window.Module.FS, Lua reads via love.filesystem
 *
 * Both sides batch messages and flush once per frame.
 */

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────
  var namespace = 'default';
  var OUTBOX_PATH, INBOX_PATH, READY_PATH;
  var SAVE_DIR; // love.filesystem save directory within window.Module.FS

  function setPaths(ns) {
    namespace = ns || 'default';
    var prefix = ns === 'default' ? '__bridge' : '__bridge_' + ns;
    OUTBOX_PATH = prefix + '_out.json';
    INBOX_PATH  = prefix + '_in.json';
    READY_PATH  = '__bridge_' + namespace + '_ready';
  }
  setPaths('default');

  // ── State ───────────────────────────────────────────────
  var listeners = {};    // type -> Set<fn>
  var commandQueue = []; // queued commands for Lua
  var ready = false;
  var rpcIdCounter = 0;

  // ── Public API (window.ReactJITBridge) ──────────────────

  var Bridge = {
    /**
     * Subscribe to events from Lua.
     * Returns an unsubscribe function.
     */
    subscribe: function (type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
      return function () {
        var arr = listeners[type];
        if (!arr) return;
        var idx = arr.indexOf(fn);
        if (idx >= 0) arr.splice(idx, 1);
        if (arr.length === 0) delete listeners[type];
      };
    },

    /**
     * Queue a command for Lua. Batched, not sent immediately.
     */
    send: function (type, payload) {
      commandQueue.push({ type: type, payload: payload });
    },

    /**
     * Flush all queued commands to Lua via window.Module.FS.
     */
    flush: function () {
      if (commandQueue.length === 0 || !ready) return;
      try {
        var json = JSON.stringify(commandQueue);
        writeFS(INBOX_PATH, json);
      } catch (e) {
        console.error('[Bridge] Failed to write inbox:', e);
      }
      commandQueue = [];
    },

    /**
     * RPC call to Lua. Returns a Promise.
     */
    rpc: function (method, args, timeoutMs) {
      timeoutMs = timeoutMs || 5000;
      var id = ++rpcIdCounter;
      var responseType = 'rpc:' + id;

      return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
          unsub();
          reject(new Error("RPC '" + method + "' timed out after " + timeoutMs + 'ms'));
        }, timeoutMs);

        var unsub = Bridge.subscribe(responseType, function (payload) {
          clearTimeout(timer);
          unsub();
          if (payload && payload.error) {
            reject(new Error(payload.error));
          } else {
            resolve(payload && 'result' in payload ? payload.result : null);
          }
        });

        Bridge.send('rpc:call', { id: id, method: method, args: args });
        Bridge.flush();
      });
    },

    /**
     * Check if the Lua side is ready.
     */
    isReady: function () {
      return ready;
    },

    /**
     * Set the namespace for multi-instance support.
     */
    setNamespace: function (ns) {
      setPaths(ns);
    },

    /**
     * Get the discovered window.Module.FS save directory path.
     */
    getSaveDir: function () {
      return SAVE_DIR;
    },
  };

  // ── Emscripten FS helpers ──────────────────────────────────
  // love.js compat build doesn't expose Module.FS directly.
  // postRun in index.html captures it as Module._FS.

  function getFS() {
    return (Module && Module.FS) || null;
  }

  function findSaveDir() {
    var fs = getFS();
    if (!fs) return null;
    var candidates = [
      '/home/web_user/love/reactjit-web/',
      '/home/web_user/love/',
      '/home/web_user/.local/share/love/reactjit-web/',
      '/home/web_user/.local/share/love/reactjit/',
      '/home/web_user/.local/share/love/',
    ];
    for (var i = 0; i < candidates.length; i++) {
      try {
        fs.stat(candidates[i]);
        return candidates[i];
      } catch (e) { /* not found, try next */ }
    }
    return null;
  }

  function readFS(filename) {
    var fs = getFS();
    if (!SAVE_DIR || !fs) return null;
    var path = SAVE_DIR + filename;
    try {
      fs.stat(path);
      var data = fs.readFile(path, { encoding: 'utf8' });
      fs.unlink(path);
      return data;
    } catch (e) {
      return null;
    }
  }

  function writeFS(filename, data) {
    var fs = getFS();
    if (!SAVE_DIR || !fs) return;
    var path = SAVE_DIR + filename;
    fs.writeFile(path, data);
  }

  function checkReady() {
    var fs = getFS();
    if (!fs) return false;
    if (!SAVE_DIR) {
      SAVE_DIR = findSaveDir();
      if (!SAVE_DIR) return false;
    }
    try {
      fs.stat(SAVE_DIR + READY_PATH);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── Polling loop ───────────────────────────────────────

  function pollOutbox() {
    var raw = readFS(OUTBOX_PATH);
    if (!raw) return;

    var events;
    try {
      events = JSON.parse(raw);
    } catch (e) {
      console.error('[Bridge] Failed to parse outbox:', e);
      return;
    }

    for (var i = 0; i < events.length; i++) {
      var evt = events[i];
      if (!evt || !evt.type) continue;
      var fns = listeners[evt.type];
      if (!fns) continue;
      // Copy array in case a handler unsubscribes
      var snapshot = fns.slice();
      for (var j = 0; j < snapshot.length; j++) {
        try {
          snapshot[j](evt.payload);
        } catch (e) {
          console.error('[Bridge] Handler error (' + evt.type + '):', e);
        }
      }
    }
  }

  var tickCount = 0;
  function tick() {
    tickCount++;
    if (!ready) {
      if (tickCount % 60 === 1) {
        console.log('[Bridge] tick #' + tickCount + ' waiting for ready... window.Module.FS=' + !!(typeof Module !== 'undefined' && window.Module.FS) + ' SAVE_DIR=' + SAVE_DIR);
      }
      if (typeof Module !== 'undefined' && getFS() && checkReady()) {
        ready = true;
        console.log('[Bridge] Lua side ready — starting bridge polling (SAVE_DIR=' + SAVE_DIR + ')');
        // Dispatch ready event
        var fns = listeners['bridge:ready'];
        if (fns) {
          var snapshot = fns.slice();
          for (var i = 0; i < snapshot.length; i++) {
            try { snapshot[i]({}); } catch (e) { /* ignore */ }
          }
        }
      }
    }

    if (ready) {
      pollOutbox();
    }

    requestAnimationFrame(tick);
  }

  // ── Start ──────────────────────────────────────────────

  window.ReactJITBridge = Bridge;

  // Start polling after love.js has had time to initialize window.Module.FS.
  // We try multiple strategies because the compat build may init async.
  function startPolling() {
    console.log('[Bridge] Starting poll loop (window.Module.FS available)');
    requestAnimationFrame(tick);
  }

  if (getFS()) {
    startPolling();
  } else {
    // Poll until FS is available (postRun captures it as Module._FS)
    var waitForFS = setInterval(function () {
      if (getFS()) {
        clearInterval(waitForFS);
        startPolling();
      }
    }, 100);
  }
})();
