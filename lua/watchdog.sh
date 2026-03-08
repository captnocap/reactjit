#!/bin/bash
# watchdog.sh — Memory spike watchdog for Love2D/ReactJIT
#
# Usage: watchdog.sh <PID> [SPIKE_MB] [SAMPLE_MS] [WARMUP_MS]
#
# Monitors /proc/$PID/statm for sustained RSS growth.
# If RSS grows by more than SPIKE_MB for 3 CONSECUTIVE samples,
# the process is in an infinite allocation loop. Kill it.
#
# Spike #1: Warning — just count.
# Spike #2: PANIC MODE — switch to 20ms sampling, collect /proc diagnostics,
#           signal Lua side to write subsystem snapshot, log deltas.
# Spike #3: Kill — merge all diagnostics into crash file, spawn reporter.
#
# A single burst (loading assets, stress test) spikes once then flattens.
# An infinite loop spikes every single sample and never stops.
# Requiring 3 consecutive spikes eliminates false positives from
# legitimate large allocations (even 500MB+).
#
# Empirical data:
#   Normal operation: <1MB delta per 100ms
#   Legitimate burst: one spike then flat
#   Infinite loop:    70-100MB delta EVERY sample, forever

PID="${1:?Usage: watchdog.sh <PID> [SPIKE_MB] [SAMPLE_MS] [WARMUP_MS]}"
SPIKE_MB="${2:-50}"
SAMPLE_MS="${3:-100}"
WARMUP_MS="${4:-3000}"

SPIKE_KB=$((SPIKE_MB * 1024))
SLEEP_S=$(awk "BEGIN {printf \"%.3f\", $SAMPLE_MS / 1000}")
PANIC_SLEEP_S="0.020"
LAST_RSS=0
CONSECUTIVE=0
KILL_AFTER=3
START_NS=$(date +%s%N)
TMPDIR="${TMPDIR:-/tmp}"
PANIC_MODE=0
PANIC_DELTAS=""

# Heartbeat freeze detection
HEARTBEAT_FILE="$TMPDIR/reactjit_heartbeat_${PID}"
HEARTBEAT_TIMEOUT=5   # seconds without heartbeat update = frozen
HEARTBEAT_GRACE=10    # seconds after startup before checking (Lua needs time to start writing)

# Collect /proc diagnostics for the target PID.
# Writes to $1 (output variable name is avoided; prints to stdout).
collect_proc_snapshot() {
  local snap=""

  # Thread count
  if [ -f "/proc/$PID/status" ]; then
    local threads=$(grep -m1 '^Threads:' "/proc/$PID/status" 2>/dev/null | awk '{print $2}')
    snap="${snap}threads=${threads:-?}\n"
  fi

  # File descriptor count
  if [ -d "/proc/$PID/fd" ]; then
    local fds=$(ls "/proc/$PID/fd" 2>/dev/null | wc -l)
    snap="${snap}fds=${fds}\n"
  fi

  # VmRSS, VmSize, VmSwap from status
  if [ -f "/proc/$PID/status" ]; then
    local vmrss=$(grep -m1 '^VmRSS:' "/proc/$PID/status" 2>/dev/null | awk '{print $2}')
    local vmsize=$(grep -m1 '^VmSize:' "/proc/$PID/status" 2>/dev/null | awk '{print $2}')
    local vmswap=$(grep -m1 '^VmSwap:' "/proc/$PID/status" 2>/dev/null | awk '{print $2}')
    snap="${snap}vmRSS_kB=${vmrss:-0}\nvmSize_kB=${vmsize:-0}\nvmSwap_kB=${vmswap:-0}\n"
  fi

  # Context switches (voluntary + nonvoluntary)
  if [ -f "/proc/$PID/status" ]; then
    local vctx=$(grep -m1 '^voluntary_ctxt_switches:' "/proc/$PID/status" 2>/dev/null | awk '{print $2}')
    local nvctx=$(grep -m1 '^nonvoluntary_ctxt_switches:' "/proc/$PID/status" 2>/dev/null | awk '{print $2}')
    snap="${snap}ctxSwitchVol=${vctx:-0}\nctxSwitchInvol=${nvctx:-0}\n"
  fi

  # I/O stats
  if [ -f "/proc/$PID/io" ]; then
    local rbytes=$(grep -m1 '^read_bytes:' "/proc/$PID/io" 2>/dev/null | awk '{print $2}')
    local wbytes=$(grep -m1 '^write_bytes:' "/proc/$PID/io" 2>/dev/null | awk '{print $2}')
    snap="${snap}ioReadBytes=${rbytes:-0}\nioWriteBytes=${wbytes:-0}\n"
  fi

  # Anonymous memory regions count + total size (heap pressure indicator)
  if [ -f "/proc/$PID/maps" ]; then
    local anon_count=$(grep -c '\[heap\]\|anon' "/proc/$PID/maps" 2>/dev/null || echo 0)
    snap="${snap}anonRegions=${anon_count}\n"
  fi

  printf '%b' "$snap"
}

CACHED_CMDLINE=""
CACHED_CWD=""

while kill -0 "$PID" 2>/dev/null; do
  if [ ! -f "/proc/$PID/statm" ]; then
    break  # process gone — fall through to crash detection
  fi

  # Cache command line and cwd while alive (needed for crash report if process dies)
  if [ -z "$CACHED_CMDLINE" ] && [ -f "/proc/$PID/cmdline" ]; then
    CACHED_CMDLINE=$(tr '\0' ' ' < "/proc/$PID/cmdline" 2>/dev/null | sed 's/ $//' || true)
    CACHED_CWD=$(readlink "/proc/$PID/cwd" 2>/dev/null || true)
  fi

  RSS_PAGES=$(awk '{print $2}' "/proc/$PID/statm" 2>/dev/null || echo 0)
  RSS_KB=$((RSS_PAGES * 4))

  if [ "$LAST_RSS" -gt 0 ]; then
    DELTA_KB=$((RSS_KB - LAST_RSS))
    DELTA_MB=$((DELTA_KB / 1024))
    RSS_MB=$((RSS_KB / 1024))
    NOW_NS=$(date +%s%N)
    ELAPSED_MS=$(( (NOW_NS - START_NS) / 1000000 ))

    if [ "$ELAPSED_MS" -gt "$WARMUP_MS" ] && [ "$DELTA_KB" -gt "$SPIKE_KB" ]; then
      CONSECUTIVE=$((CONSECUTIVE + 1))
    else
      CONSECUTIVE=0
      # If we were in panic mode but spikes stopped, stand down
      if [ "$PANIC_MODE" -eq 1 ]; then
        PANIC_MODE=0
        PANIC_DELTAS=""
        SLEEP_S=$(awk "BEGIN {printf \"%.3f\", $SAMPLE_MS / 1000}")
        # Clean up signal file
        rm -f "$TMPDIR/reactjit_panic.signal"
      fi
    fi

    # ================================================================
    # SPIKE #2: Enter panic snapshot mode
    # ================================================================
    if [ "$CONSECUTIVE" -eq 2 ] && [ "$PANIC_MODE" -eq 0 ]; then
      PANIC_MODE=1
      echo "" >&2
      echo "[WATCHDOG] PANIC MODE — 2 consecutive spikes >${SPIKE_MB}MB (RSS: ${RSS_MB}MB, delta: +${DELTA_MB}MB)" >&2
      echo "[WATCHDOG] Switching to high-frequency sampling (20ms)" >&2

      # Switch to high-frequency sampling
      SLEEP_S="$PANIC_SLEEP_S"

      # Signal the Lua side to collect subsystem snapshot
      echo "$RSS_MB" > "$TMPDIR/reactjit_panic.signal"

      # Collect /proc diagnostics
      PROC_SNAPSHOT=$(collect_proc_snapshot)

      # Start logging deltas
      PANIC_DELTAS="spike#2: +${DELTA_MB}MB (RSS=${RSS_MB}MB)"
    fi

    # Log deltas during panic mode (between spike #2 and #3)
    if [ "$PANIC_MODE" -eq 1 ] && [ "$CONSECUTIVE" -gt 2 ]; then
      PANIC_DELTAS="${PANIC_DELTAS}\nspike#${CONSECUTIVE}: +${DELTA_MB}MB (RSS=${RSS_MB}MB)"
    fi

    # ================================================================
    # SPIKE #3+: Kill with full diagnostics
    # ================================================================
    if [ "$CONSECUTIVE" -ge "$KILL_AFTER" ]; then
      RSS_MB=$((RSS_KB / 1024))
      echo "" >&2
      echo "[WATCHDOG] Sustained memory growth: ${CONSECUTIVE} consecutive spikes >${SPIKE_MB}MB (RSS now: ${RSS_MB}MB)" >&2
      echo "[WATCHDOG] Killing PID $PID" >&2

      # Capture the original command line before killing
      CMDLINE=""
      if [ -f "/proc/$PID/cmdline" ]; then
        CMDLINE=$(tr '\0' ' ' < "/proc/$PID/cmdline" 2>/dev/null | sed 's/ $//')
      fi
      CWD=$(readlink "/proc/$PID/cwd" 2>/dev/null || echo "")

      # Final /proc snapshot (things may have changed since spike #2)
      FINAL_PROC=$(collect_proc_snapshot)

      kill -9 "$PID" 2>/dev/null

      # Kill registered child processes
      if [ -f "$TMPDIR/reactjit_children_${PID}" ]; then
        while IFS= read -r cpid; do
          cpid=$(echo "$cpid" | tr -d '[:space:]')
          [ -n "$cpid" ] && kill "$cpid" 2>/dev/null
        done < "$TMPDIR/reactjit_children_${PID}"
        sleep 0.2
        while IFS= read -r cpid; do
          cpid=$(echo "$cpid" | tr -d '[:space:]')
          [ -n "$cpid" ] && kill -9 "$cpid" 2>/dev/null
        done < "$TMPDIR/reactjit_children_${PID}"
        rm -f "$TMPDIR/reactjit_children_${PID}"
      fi

      # Clean up signal file
      rm -f "$TMPDIR/reactjit_panic.signal"

      # Read Lua-side snapshot if it exists (written by __hostFlush)
      LUA_SNAPSHOT=""
      SNAPSHOT_FILE="$TMPDIR/reactjit_snapshot.lua"
      if [ -f "$SNAPSHOT_FILE" ] && [ -s "$SNAPSHOT_FILE" ]; then
        LUA_SNAPSHOT=$(cat "$SNAPSHOT_FILE")
      fi

      # Read persisted event trail (written by Lua alongside heartbeat)
      TRAIL_FILE="$TMPDIR/reactjit_trail_${PID}.txt"
      TRAIL_CONTENT=""
      if [ -f "$TRAIL_FILE" ] && [ -s "$TRAIL_FILE" ]; then
        TRAIL_CONTENT=$(cat "$TRAIL_FILE" 2>/dev/null || true)
        rm -f "$TRAIL_FILE"
      fi
      TRAIL_ESC=$(printf '%s' "$TRAIL_CONTENT" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/' | tr -d '\n' | sed 's/\\n$//')

      # Crisis analysis: the crash reporter reads /tmp/reactjit_crisis.lua directly
      # (written by the flight recorder via FFI syscalls). No extraction needed here.

      # Kill any previous crash reporter window before spawning a new one
      if [ -f "$TMPDIR/reactjit_crashreporter.pid" ]; then
        PREV_CR=$(cat "$TMPDIR/reactjit_crashreporter.pid" 2>/dev/null)
        [ -n "$PREV_CR" ] && kill "$PREV_CR" 2>/dev/null
        rm -f "$TMPDIR/reactjit_crashreporter.pid"
      fi

      # Build comprehensive crash file
      CRASH_FILE="$TMPDIR/reactjit_crash.lua"
      CMDLINE_ESC=$(echo "$CMDLINE" | sed 's/\\/\\\\/g; s/"/\\"/g')
      CWD_ESC=$(echo "$CWD" | sed 's/\\/\\\\/g; s/"/\\"/g')
      DELTAS_ESC=$(printf '%b' "$PANIC_DELTAS" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/' | tr -d '\n' | sed 's/\\n$//')
      PROC_ESC=$(echo "$PROC_SNAPSHOT" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/' | tr -d '\n' | sed 's/\\n$//')
      FINAL_PROC_ESC=$(echo "$FINAL_PROC" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/' | tr -d '\n' | sed 's/\\n$//')

      # If Lua already wrote a crash file, merge into it
      if [ -f "$CRASH_FILE" ] && [ -s "$CRASH_FILE" ]; then
        sed -i 's/}$//' "$CRASH_FILE"
        echo "  rebootCmd = \"${CMDLINE_ESC}\"," >> "$CRASH_FILE"
        echo "  rebootCwd = \"${CWD_ESC}\"," >> "$CRASH_FILE"
        echo "  panicDeltas = \"${DELTAS_ESC}\"," >> "$CRASH_FILE"
        echo "  procSnapshot = \"${PROC_ESC}\"," >> "$CRASH_FILE"
        echo "  procFinal = \"${FINAL_PROC_ESC}\"," >> "$CRASH_FILE"
        echo "  rssMB = ${RSS_MB}," >> "$CRASH_FILE"
        if [ -n "$LUA_SNAPSHOT" ]; then
          echo "  hasLuaSnapshot = true," >> "$CRASH_FILE"
        fi
        if [ -n "$TRAIL_CONTENT" ]; then
          echo "  trail = \"${TRAIL_ESC}\"," >> "$CRASH_FILE"
        fi
        echo "}" >> "$CRASH_FILE"
      else
        cat > "$CRASH_FILE" << CRASHEOF
return {
  error = "[WATCHDOG] Process killed — sustained memory growth: ${CONSECUTIVE} consecutive spikes >${SPIKE_MB}MB (RSS: ${RSS_MB}MB)",
  context = "watchdog kill (panic snapshot)",
  timestamp = "$(date '+%Y-%m-%d %H:%M:%S')",
  rebootCmd = "${CMDLINE_ESC}",
  rebootCwd = "${CWD_ESC}",
  panicDeltas = "${DELTAS_ESC}",
  procSnapshot = "${PROC_ESC}",
  procFinal = "${FINAL_PROC_ESC}",
  rssMB = ${RSS_MB},
  trail = "${TRAIL_ESC}",
CRASHEOF
        if [ -n "$LUA_SNAPSHOT" ]; then
          echo "  hasLuaSnapshot = true," >> "$CRASH_FILE"
        fi
        echo "}" >> "$CRASH_FILE"
      fi

      # Spawn crash report window
      SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
      if [ -f "$SCRIPT_DIR/crashreport/main.lua" ]; then
        love "$SCRIPT_DIR/crashreport" &
        echo $! > "$TMPDIR/reactjit_crashreporter.pid"
      fi
      exit 0
    fi
  fi

  # ================================================================
  # HEARTBEAT: Detect frozen processes (alive but not rendering)
  # ================================================================
  # After the grace period, check if the heartbeat file exists and is recent.
  # The Lua side writes os.time() to this file every ~60 frames (~1/sec).
  # If it's stale for >HEARTBEAT_TIMEOUT seconds, the process is frozen.
  NOW_EPOCH=$(date +%s)
  BOOT_ELAPSED=$(( NOW_EPOCH - (START_NS / 1000000000) ))
  if [ "$BOOT_ELAPSED" -gt "$HEARTBEAT_GRACE" ] && [ -f "$HEARTBEAT_FILE" ]; then
    HEARTBEAT_TS=$(cat "$HEARTBEAT_FILE" 2>/dev/null || echo 0)
    # Validate: must be a recent epoch timestamp (not empty/zero/garbage)
    if [ -z "$HEARTBEAT_TS" ] || ! [ "$HEARTBEAT_TS" -gt 0 ] 2>/dev/null; then
      HEARTBEAT_TS=0
    fi
    # Skip if timestamp is clearly bogus (age > 1 hour = bad read, retry next cycle)
    HEARTBEAT_AGE=$(( NOW_EPOCH - HEARTBEAT_TS ))
    if [ "$HEARTBEAT_TS" -gt 0 ] && [ "$HEARTBEAT_AGE" -gt "$HEARTBEAT_TIMEOUT" ] && [ "$HEARTBEAT_AGE" -lt 3600 ]; then
      RSS_MB=$((RSS_KB / 1024))
      echo "" >&2
      echo "[WATCHDOG] FROZEN — heartbeat stale for ${HEARTBEAT_AGE}s (threshold: ${HEARTBEAT_TIMEOUT}s, RSS: ${RSS_MB}MB)" >&2
      echo "[WATCHDOG] Killing PID $PID" >&2

      CMDLINE=""
      if [ -f "/proc/$PID/cmdline" ]; then
        CMDLINE=$(tr '\0' ' ' < "/proc/$PID/cmdline" 2>/dev/null | sed 's/ $//')
      fi
      CWD=$(readlink "/proc/$PID/cwd" 2>/dev/null || echo "")

      kill -9 "$PID" 2>/dev/null

      # Kill registered child processes
      if [ -f "$TMPDIR/reactjit_children_${PID}" ]; then
        while IFS= read -r cpid; do
          cpid=$(echo "$cpid" | tr -d '[:space:]')
          [ -n "$cpid" ] && kill "$cpid" 2>/dev/null
        done < "$TMPDIR/reactjit_children_${PID}"
        sleep 0.2
        while IFS= read -r cpid; do
          cpid=$(echo "$cpid" | tr -d '[:space:]')
          [ -n "$cpid" ] && kill -9 "$cpid" 2>/dev/null
        done < "$TMPDIR/reactjit_children_${PID}"
        rm -f "$TMPDIR/reactjit_children_${PID}"
      fi

      rm -f "$HEARTBEAT_FILE"

      # Read persisted event trail (written by Lua alongside heartbeat)
      TRAIL_FILE="$TMPDIR/reactjit_trail_${PID}.txt"
      TRAIL_CONTENT=""
      if [ -f "$TRAIL_FILE" ] && [ -s "$TRAIL_FILE" ]; then
        TRAIL_CONTENT=$(cat "$TRAIL_FILE" 2>/dev/null || true)
        rm -f "$TRAIL_FILE"
      fi
      TRAIL_ESC=$(printf '%s' "$TRAIL_CONTENT" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/' | tr -d '\n' | sed 's/\\n$//')

      # Build crash report
      CRASH_FILE="$TMPDIR/reactjit_crash.lua"
      CMDLINE_ESC=$(echo "$CMDLINE" | sed 's/\\/\\\\/g; s/"/\\"/g')
      CWD_ESC=$(echo "$CWD" | sed 's/\\/\\\\/g; s/"/\\"/g')

      cat > "$CRASH_FILE" << CRASHEOF
return {
  error = "[WATCHDOG] Process frozen — no heartbeat for ${HEARTBEAT_AGE}s (RSS: ${RSS_MB}MB)",
  context = "watchdog kill (heartbeat timeout)",
  crashType = "freeze",
  timestamp = "$(date '+%Y-%m-%d %H:%M:%S')",
  rebootCmd = "${CMDLINE_ESC}",
  rebootCwd = "${CWD_ESC}",
  rssMB = ${RSS_MB},
  heartbeatAge = ${HEARTBEAT_AGE},
  trail = "${TRAIL_ESC}",
}
CRASHEOF

      echo "[WATCHDOG] Crash report written to $CRASH_FILE" >&2

      # Kill any previous crash reporter window before spawning a new one
      if [ -f "$TMPDIR/reactjit_crashreporter.pid" ]; then
        PREV_CR=$(cat "$TMPDIR/reactjit_crashreporter.pid" 2>/dev/null)
        [ -n "$PREV_CR" ] && kill "$PREV_CR" 2>/dev/null
        rm -f "$TMPDIR/reactjit_crashreporter.pid"
      fi

      # Spawn crash report window
      SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
      if [ -f "$SCRIPT_DIR/crashreport/main.lua" ]; then
        love "$SCRIPT_DIR/crashreport" &
        echo $! > "$TMPDIR/reactjit_crashreporter.pid"
      fi
      exit 0
    fi
  fi

  LAST_RSS=$RSS_KB
  sleep "$SLEEP_S"
done

# ================================================================
# POST-LOOP: Process vanished (we didn't kill it)
# ================================================================
# If we reach here, the while loop exited because kill -0 failed —
# the process is gone. The watchdog's own kill path exits before
# reaching here (exit 0 after spawning crash reporter). So if we're
# here, the process died on its own.
#
# Check for a clean-exit marker written by ReactJIT.quit().
# If the marker exists → normal quit (user closed window, love.event.quit()).
# If the marker is missing → crash (segfault, SIGABRT, SIGBUS, etc.).

CLEAN_EXIT_MARKER="$TMPDIR/reactjit_clean_exit"
CHILDREN_FILE="$TMPDIR/reactjit_children_${PID}"

# Kill any registered child processes (Tor, child windows, devtools pop-outs, etc.)
# This runs on BOTH clean exit and crash — the Lua-side killAll() handles clean exit,
# but if the process crashed, love.quit() never ran and children are orphaned.
if [ -f "$CHILDREN_FILE" ]; then
  echo "[WATCHDOG] Cleaning up child processes from $CHILDREN_FILE" >&2
  while IFS= read -r child_pid; do
    child_pid=$(echo "$child_pid" | tr -d '[:space:]')
    if [ -n "$child_pid" ] && kill -0 "$child_pid" 2>/dev/null; then
      echo "[WATCHDOG] Killing child PID $child_pid" >&2
      kill "$child_pid" 2>/dev/null
    fi
  done < "$CHILDREN_FILE"
  # Brief pause then SIGKILL stragglers
  sleep 0.2
  while IFS= read -r child_pid; do
    child_pid=$(echo "$child_pid" | tr -d '[:space:]')
    if [ -n "$child_pid" ] && kill -0 "$child_pid" 2>/dev/null; then
      kill -9 "$child_pid" 2>/dev/null
    fi
  done < "$CHILDREN_FILE"
  rm -f "$CHILDREN_FILE"
fi

# Clean up heartbeat file
rm -f "$HEARTBEAT_FILE"

# Read persisted event trail before any exit (needed for crash report)
TRAIL_FILE="$TMPDIR/reactjit_trail_${PID}.txt"
TRAIL_CONTENT=""
if [ -f "$TRAIL_FILE" ] && [ -s "$TRAIL_FILE" ]; then
  TRAIL_CONTENT=$(cat "$TRAIL_FILE" 2>/dev/null || true)
fi

if [ -f "$CLEAN_EXIT_MARKER" ]; then
  # Normal exit — clean up marker, trail file, and go
  rm -f "$CLEAN_EXIT_MARKER"
  rm -f "$TRAIL_FILE"
  exit 0
fi

# ── Crash detected ──────────────────────────────────────────────
echo "" >&2
echo "[WATCHDOG] Process $PID vanished without clean exit — probable crash (segfault/signal)" >&2

# Clean up trail file (we already read it)
rm -f "$TRAIL_FILE"
TRAIL_ESC=$(printf '%s' "$TRAIL_CONTENT" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/' | tr -d '\n' | sed 's/\\n$//')

# Capture the original command line if we saved it during monitoring
# (process is already dead, /proc is gone — we need to have cached it)
# We poll cmdline on each sample if available; stash it while alive.
# Since we didn't capture it in the loop, reconstruct from what we know.

CRASH_FILE="$TMPDIR/reactjit_crash.lua"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Forensics: find the segfault line and decode it ──────────────
DMESG_LINE=""
FAULT_LIB=""
FAULT_ADDR=""
FAULT_OFFSET=""
FAULT_SYMBOL=""

# Try journalctl -k first (works without root), fall back to dmesg
if command -v journalctl >/dev/null 2>&1; then
  DMESG_LINE=$(journalctl -k -g "segfault" --no-pager -n 20 2>/dev/null | grep "\[$PID\]" | tail -1 || true)
fi
if [ -z "$DMESG_LINE" ] && command -v dmesg >/dev/null 2>&1; then
  DMESG_LINE=$(dmesg --time-format iso 2>/dev/null | grep -i "segfault" | grep "\[$PID\]" | tail -1 || true)
  if [ -z "$DMESG_LINE" ]; then
    DMESG_LINE=$(dmesg 2>/dev/null | grep -i "segfault" | grep "\[$PID\]" | tail -1 || true)
  fi
fi

# Parse the kernel segfault line:
#   love[PID]: segfault at <addr> ip <ip> sp <sp> error N in <lib>[<offset>,<base>+<size>]
if [ -n "$DMESG_LINE" ]; then
  # Extract faulting library name (e.g. "libc.so.6", "libsodium.so.23")
  FAULT_LIB=$(echo "$DMESG_LINE" | grep -oP 'in \K[^\[]+' | head -1 | xargs)
  # Extract the offset within the library (first value in brackets)
  FAULT_OFFSET=$(echo "$DMESG_LINE" | grep -oP 'in [^\[]+\[\K[0-9a-f]+' | head -1)
  # Extract the faulting address (the memory being accessed — often a guard page)
  FAULT_ADDR=$(echo "$DMESG_LINE" | grep -oP 'segfault at \K[0-9a-f]+' | head -1)

  echo "[WATCHDOG] Segfault in: ${FAULT_LIB:-unknown} at offset 0x${FAULT_OFFSET:-?}" >&2
  echo "[WATCHDOG] Faulting address: 0x${FAULT_ADDR:-?}" >&2

  # Try to resolve the symbol via addr2line
  if [ -n "$FAULT_OFFSET" ] && command -v addr2line >/dev/null 2>&1; then
    # Find the actual .so path on disk
    LIB_PATH=""
    if [ -n "$FAULT_LIB" ]; then
      LIB_PATH=$(find /usr/lib /lib -name "$FAULT_LIB" -type f 2>/dev/null | head -1)
      # Also check LD_LIBRARY_PATH and the app's lib/ directory
      if [ -z "$LIB_PATH" ] && [ -n "$CACHED_CWD" ]; then
        LIB_PATH=$(find "$CACHED_CWD" -name "$FAULT_LIB" -type f 2>/dev/null | head -1)
      fi
    fi
    if [ -n "$LIB_PATH" ]; then
      FAULT_SYMBOL=$(addr2line -f -e "$LIB_PATH" "0x$FAULT_OFFSET" 2>/dev/null | head -2 | tr '\n' ' ' || true)
      if [ -n "$FAULT_SYMBOL" ]; then
        echo "[WATCHDOG] Symbol: $FAULT_SYMBOL" >&2
      fi
    fi
  fi

  # Check if the faulting address looks like a guard page (ends near page boundary)
  if [ -n "$FAULT_ADDR" ]; then
    PAGE_OFFSET=$((0x$FAULT_ADDR & 0xFFF))
    if [ "$PAGE_OFFSET" -ge 4088 ] || [ "$PAGE_OFFSET" -le 8 ]; then
      echo "[WATCHDOG] Faulting address 0x$FAULT_ADDR is at page boundary (offset $PAGE_OFFSET) — guard page hit" >&2
    fi
  fi
fi

# Check coredump info if available
COREDUMP_INFO=""
if command -v coredumpctl >/dev/null 2>&1; then
  COREDUMP_INFO=$(coredumpctl info "$PID" 2>/dev/null | head -30 || true)
fi

# Build crash report — escape for Lua string literals
DMESG_ESC=$(echo "$DMESG_LINE" | sed 's/\\/\\\\/g; s/"/\\"/g')
COREDUMP_ESC=$(echo "$COREDUMP_INFO" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/' | tr -d '\n' | sed 's/\\n$//')
FAULT_LIB_ESC=$(echo "$FAULT_LIB" | sed 's/\\/\\\\/g; s/"/\\"/g')
FAULT_SYMBOL_ESC=$(echo "$FAULT_SYMBOL" | sed 's/\\/\\\\/g; s/"/\\"/g')

# Merge into existing crash file or create new one
if [ -f "$CRASH_FILE" ] && [ -s "$CRASH_FILE" ]; then
  # Lua-side crash file exists (e.g. budget error wrote one before segfault)
  CMDLINE_ESC=$(echo "$CACHED_CMDLINE" | sed 's/\\/\\\\/g; s/"/\\"/g')
  CWD_ESC=$(echo "$CACHED_CWD" | sed 's/\\/\\\\/g; s/"/\\"/g')

  sed -i 's/}$//' "$CRASH_FILE"
  echo "  crashType = \"signal\"," >> "$CRASH_FILE"
  [ -n "$DMESG_LINE" ] && echo "  dmesg = \"${DMESG_ESC}\"," >> "$CRASH_FILE"
  [ -n "$COREDUMP_INFO" ] && echo "  coredump = \"${COREDUMP_ESC}\"," >> "$CRASH_FILE"
  [ -n "$FAULT_LIB" ] && echo "  faultLib = \"${FAULT_LIB_ESC}\"," >> "$CRASH_FILE"
  [ -n "$FAULT_OFFSET" ] && echo "  faultOffset = \"0x${FAULT_OFFSET}\"," >> "$CRASH_FILE"
  [ -n "$FAULT_SYMBOL" ] && echo "  faultSymbol = \"${FAULT_SYMBOL_ESC}\"," >> "$CRASH_FILE"
  [ -n "$FAULT_ADDR" ] && echo "  faultAddr = \"0x${FAULT_ADDR}\"," >> "$CRASH_FILE"
  [ -n "$CACHED_CMDLINE" ] && echo "  rebootCmd = \"${CMDLINE_ESC}\"," >> "$CRASH_FILE"
  [ -n "$CACHED_CWD" ] && echo "  rebootCwd = \"${CWD_ESC}\"," >> "$CRASH_FILE"
  echo "  rssMB = $((LAST_RSS / 1024))," >> "$CRASH_FILE"
  [ -n "$TRAIL_CONTENT" ] && echo "  trail = \"${TRAIL_ESC}\"," >> "$CRASH_FILE"
  echo "}" >> "$CRASH_FILE"
else
  CMDLINE_ESC=$(echo "$CACHED_CMDLINE" | sed 's/\\/\\\\/g; s/"/\\"/g')
  CWD_ESC=$(echo "$CACHED_CWD" | sed 's/\\/\\\\/g; s/"/\\"/g')

  cat > "$CRASH_FILE" << CRASHEOF
return {
  error = "[WATCHDOG] Process $PID crashed (no clean exit marker — likely segfault or fatal signal)",
  context = "process crash (signal)",
  crashType = "signal",
  timestamp = "$(date '+%Y-%m-%d %H:%M:%S')",
  dmesg = "${DMESG_ESC}",
  coredump = "${COREDUMP_ESC}",
  faultLib = "${FAULT_LIB_ESC}",
  faultOffset = "0x${FAULT_OFFSET}",
  faultSymbol = "${FAULT_SYMBOL_ESC}",
  faultAddr = "0x${FAULT_ADDR}",
  rebootCmd = "${CMDLINE_ESC}",
  rebootCwd = "${CWD_ESC}",
  rssMB = $((LAST_RSS / 1024)),
  trail = "${TRAIL_ESC}",
}
CRASHEOF
fi

echo "[WATCHDOG] Crash report written to $CRASH_FILE" >&2

# Kill any previous crash reporter window before spawning a new one
if [ -f "$TMPDIR/reactjit_crashreporter.pid" ]; then
  PREV_CR=$(cat "$TMPDIR/reactjit_crashreporter.pid" 2>/dev/null)
  [ -n "$PREV_CR" ] && kill "$PREV_CR" 2>/dev/null
  rm -f "$TMPDIR/reactjit_crashreporter.pid"
fi

# Spawn crash report window
if [ -f "$SCRIPT_DIR/crashreport/main.lua" ]; then
  echo "[WATCHDOG] Spawning crash reporter" >&2
  love "$SCRIPT_DIR/crashreport" &
  echo $! > "$TMPDIR/reactjit_crashreporter.pid"
fi
