#!/bin/bash
# watchdog.sh — Memory spike + heartbeat watchdog for tsz/ReactJIT
#
# Ported from love2d/lua/watchdog.sh. Monitors /proc/$PID/statm for sustained
# RSS growth and heartbeat file for freeze detection.
#
# Usage: watchdog.sh <PID> [SPIKE_MB] [SAMPLE_MS] [WARMUP_MS]
#
# Spike detection: 3 consecutive RSS growth > SPIKE_MB → kill -9.
# Heartbeat detection: no heartbeat update for >5s after grace period → kill -9.
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
HEARTBEAT_TIMEOUT=60
HEARTBEAT_GRACE=10

# Cache process info while alive
CACHED_CMDLINE=""
CACHED_CWD=""

collect_proc_snapshot() {
  local snap=""
  if [ -f "/proc/$PID/status" ]; then
    local threads=$(grep -m1 '^Threads:' "/proc/$PID/status" 2>/dev/null | awk '{print $2}')
    local vmrss=$(grep -m1 '^VmRSS:' "/proc/$PID/status" 2>/dev/null | awk '{print $2}')
    local vmsize=$(grep -m1 '^VmSize:' "/proc/$PID/status" 2>/dev/null | awk '{print $2}')
    snap="${snap}threads=${threads:-?} vmRSS_kB=${vmrss:-0} vmSize_kB=${vmsize:-0}\n"
  fi
  if [ -d "/proc/$PID/fd" ]; then
    local fds=$(ls "/proc/$PID/fd" 2>/dev/null | wc -l)
    snap="${snap}fds=${fds}\n"
  fi
  printf '%b' "$snap"
}

while kill -0 "$PID" 2>/dev/null; do
  if [ ! -f "/proc/$PID/statm" ]; then
    break
  fi

  # Cache command line while alive
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
      if [ "$PANIC_MODE" -eq 1 ]; then
        PANIC_MODE=0
        PANIC_DELTAS=""
        SLEEP_S=$(awk "BEGIN {printf \"%.3f\", $SAMPLE_MS / 1000}")
      fi
    fi

    # Spike #2: panic mode — high-frequency sampling
    if [ "$CONSECUTIVE" -eq 2 ] && [ "$PANIC_MODE" -eq 0 ]; then
      PANIC_MODE=1
      echo "" >&2
      echo "[WATCHDOG] PANIC MODE — 2 consecutive spikes >${SPIKE_MB}MB (RSS: ${RSS_MB}MB, delta: +${DELTA_MB}MB)" >&2
      SLEEP_S="$PANIC_SLEEP_S"
      PANIC_DELTAS="spike#2: +${DELTA_MB}MB (RSS=${RSS_MB}MB)"
    fi

    if [ "$PANIC_MODE" -eq 1 ] && [ "$CONSECUTIVE" -gt 2 ]; then
      PANIC_DELTAS="${PANIC_DELTAS}\nspike#${CONSECUTIVE}: +${DELTA_MB}MB (RSS=${RSS_MB}MB)"
    fi

    # Spike #3+: kill
    if [ "$CONSECUTIVE" -ge "$KILL_AFTER" ]; then
      RSS_MB=$((RSS_KB / 1024))
      echo "" >&2
      echo "[WATCHDOG] Sustained memory growth: ${CONSECUTIVE} consecutive spikes >${SPIKE_MB}MB (RSS now: ${RSS_MB}MB)" >&2
      echo "[WATCHDOG] Killing PID $PID" >&2

      PROC_SNAPSHOT=$(collect_proc_snapshot)
      kill -9 "$PID" 2>/dev/null

      # Write crash info to stderr (tsz doesn't have a Love2D crash reporter)
      echo "[WATCHDOG] Process diagnostics:" >&2
      printf '%b' "$PROC_SNAPSHOT" >&2
      echo "[WATCHDOG] Spike history:" >&2
      printf '%b\n' "$PANIC_DELTAS" >&2
      echo "[WATCHDOG] Command: ${CACHED_CMDLINE}" >&2
      echo "[WATCHDOG] CWD: ${CACHED_CWD}" >&2

      # Write crash file for external tooling
      CRASH_FILE="$TMPDIR/reactjit_crash_${PID}.txt"
      cat > "$CRASH_FILE" << EOF
[WATCHDOG] Process $PID killed — sustained memory growth
Time: $(date '+%Y-%m-%d %H:%M:%S')
RSS: ${RSS_MB}MB
Spikes: ${CONSECUTIVE} consecutive >${SPIKE_MB}MB
Command: ${CACHED_CMDLINE}
CWD: ${CACHED_CWD}
$(printf '%b' "$PANIC_DELTAS")
$(printf '%b' "$PROC_SNAPSHOT")
EOF
      echo "[WATCHDOG] Crash report: $CRASH_FILE" >&2
      rm -f "$HEARTBEAT_FILE"
      exit 0
    fi
  fi

  # Heartbeat freeze detection
  NOW_EPOCH=$(date +%s)
  BOOT_ELAPSED=$(( NOW_EPOCH - (START_NS / 1000000000) ))
  if [ "$BOOT_ELAPSED" -gt "$HEARTBEAT_GRACE" ] && [ -f "$HEARTBEAT_FILE" ]; then
    HEARTBEAT_TS=$(cat "$HEARTBEAT_FILE" 2>/dev/null || echo 0)
    if [ -z "$HEARTBEAT_TS" ] || ! [ "$HEARTBEAT_TS" -gt 0 ] 2>/dev/null; then
      HEARTBEAT_TS=0
    fi
    HEARTBEAT_AGE=$(( NOW_EPOCH - HEARTBEAT_TS ))
    if [ "$HEARTBEAT_TS" -gt 0 ] && [ "$HEARTBEAT_AGE" -gt "$HEARTBEAT_TIMEOUT" ] && [ "$HEARTBEAT_AGE" -lt 3600 ]; then
      RSS_MB=$((RSS_KB / 1024))
      echo "" >&2
      echo "[WATCHDOG] FROZEN — heartbeat stale for ${HEARTBEAT_AGE}s (threshold: ${HEARTBEAT_TIMEOUT}s, RSS: ${RSS_MB}MB)" >&2
      echo "[WATCHDOG] Killing PID $PID" >&2

      kill -9 "$PID" 2>/dev/null

      CRASH_FILE="$TMPDIR/reactjit_crash_${PID}.txt"
      cat > "$CRASH_FILE" << EOF
[WATCHDOG] Process $PID frozen — no heartbeat for ${HEARTBEAT_AGE}s
Time: $(date '+%Y-%m-%d %H:%M:%S')
RSS: ${RSS_MB}MB
Command: ${CACHED_CMDLINE}
CWD: ${CACHED_CWD}
EOF
      echo "[WATCHDOG] Crash report: $CRASH_FILE" >&2
      rm -f "$HEARTBEAT_FILE"
      exit 0
    fi
  fi

  LAST_RSS=$RSS_KB
  sleep "$SLEEP_S"
done

# Post-loop: process vanished (we didn't kill it)
CLEAN_EXIT_MARKER="$TMPDIR/reactjit_clean_exit_${PID}"

rm -f "$HEARTBEAT_FILE"

if [ -f "$CLEAN_EXIT_MARKER" ]; then
  rm -f "$CLEAN_EXIT_MARKER"
  exit 0
fi

# Unexpected death (segfault, signal)
echo "" >&2
echo "[WATCHDOG] Process $PID vanished without clean exit — probable crash" >&2

# Try to get segfault info from kernel log
DMESG_LINE=""
if command -v journalctl >/dev/null 2>&1; then
  DMESG_LINE=$(journalctl -k -g "segfault" --no-pager -n 20 2>/dev/null | grep "\[$PID\]" | tail -1 || true)
fi
if [ -z "$DMESG_LINE" ] && command -v dmesg >/dev/null 2>&1; then
  DMESG_LINE=$(dmesg 2>/dev/null | grep -i "segfault" | grep "\[$PID\]" | tail -1 || true)
fi

if [ -n "$DMESG_LINE" ]; then
  echo "[WATCHDOG] Kernel: $DMESG_LINE" >&2
fi

CRASH_FILE="$TMPDIR/reactjit_crash_${PID}.txt"
cat > "$CRASH_FILE" << EOF
[WATCHDOG] Process $PID crashed (no clean exit marker)
Time: $(date '+%Y-%m-%d %H:%M:%S')
RSS: $((LAST_RSS / 1024))MB
Command: ${CACHED_CMDLINE}
CWD: ${CACHED_CWD}
Kernel: ${DMESG_LINE}
EOF
echo "[WATCHDOG] Crash report: $CRASH_FILE" >&2
