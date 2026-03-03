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

while kill -0 "$PID" 2>/dev/null; do
  if [ ! -f "/proc/$PID/statm" ]; then
    exit 0
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

      # Clean up signal file
      rm -f "$TMPDIR/reactjit_panic.signal"

      # Read Lua-side snapshot if it exists (written by __hostFlush)
      LUA_SNAPSHOT=""
      SNAPSHOT_FILE="$TMPDIR/reactjit_snapshot.lua"
      if [ -f "$SNAPSHOT_FILE" ] && [ -s "$SNAPSHOT_FILE" ]; then
        LUA_SNAPSHOT=$(cat "$SNAPSHOT_FILE")
      fi

      # Crisis analysis: the crash reporter reads /tmp/reactjit_crisis.lua directly
      # (written by the flight recorder via FFI syscalls). No extraction needed here.

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
      fi
      exit 0
    fi
  fi

  LAST_RSS=$RSS_KB
  sleep "$SLEEP_S"
done
