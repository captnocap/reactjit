#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
REPO_ROOT="${2:-/home/siah/creative/reactjit}"
TRAIL_ROOT="${3:-/run/user/${UID:-1000}/claude-sessions/reactjit/edit-trail-wt}"
LIMIT="${4:-120}"

FRESH_DAYS=7
LAG_WARN_SECONDS=1800
LAG_CRITICAL_SECONDS=7200
NOW_EPOCH="$(date +%s)"
FRESH_CUTOFF_DAY="$(date -d "@$(($NOW_EPOCH - ($FRESH_DAYS * 24 * 60 * 60)))" +%Y-%m-%d)"

usage() {
  echo "Usage: $0 <commits|recent-edits|restore-points|worker-lag> [repo_root] [trail_root] [limit]"
}

sanitize_path() {
  local path="${1:-}"
  local fallback="${2:-}"

  if [ -z "$path" ]; then
    echo "$fallback"
    return 0
  fi

  if [ -d "$path" ]; then
    echo "$path"
    return 0
  fi

  echo "$fallback"
}

if [ -z "$MODE" ]; then
  usage
  exit 1
fi

case "$LIMIT" in
  ''|*[!0-9]*)
    echo "ERR\tinvalid_limit\t$LIMIT"
    exit 1
    ;;
esac

REPO_ROOT="$(sanitize_path "$REPO_ROOT" '/home/siah/creative/reactjit')"
TRAIL_ROOT="$(sanitize_path "$TRAIL_ROOT" "/run/user/${UID:-1000}/claude-sessions/reactjit/edit-trail-wt")"

if ! command -v git >/dev/null 2>&1; then
  echo "ERR\tmissing_command\tgit"
  exit 1
fi

if [ ! -d "$REPO_ROOT/.git" ]; then
  echo "ERR\tnot_a_git_repo\t$REPO_ROOT"
  exit 1
fi

emit_commit_overview() {
  git -C "$REPO_ROOT" log --date=short --format='%cs' 2>/dev/null \
    | sort \
    | uniq -c \
    | awk '{
        day = $2;
        count = $1 + 0;
        print "DAY\t" day "\t" count;
        total += count;
        if (first == "" || day < first) first = day;
        if (last == "" || day > last) last = day;
      }
      END {
        print "TOTAL\t" total;
        if (first != "") print "FIRST\t" first;
        if (last != "") print "LAST\t" last;
      }
    '

  git -C "$REPO_ROOT" log --max-count="$LIMIT" --date=short --format='%h\t%cs\t%an\t%s' 2>/dev/null \
    | awk -F '\t' '
      NF >= 4 {
        msg = $4;
        gsub(/\t/, " ", msg);
        gsub(/\r/, "", msg);
        print "RECENT\t" $1 "\t" $2 "\t" $3 "\t" msg;
      }
    '

  git -C "$REPO_ROOT" log --diff-filter=A --date=short --format='DATE\t%cs' --name-only -- . 2>/dev/null \
    | awk -F '\t' -v cutoff_day="$FRESH_CUTOFF_DAY" '
      function ends_with(str, suffix) {
        return length(str) >= length(suffix) && substr(str, length(str) - length(suffix) + 1) == suffix;
      }

      function area_of(path) {
        if (path ~ /^tsz\/compiler\//) return "compiler";
        if (path ~ /^tsz\/framework\//) return "framework";
        if (path ~ /^tsz\/carts\/conformance\//) return "conformance";
        if (path ~ /^tsz\/carts\/tools\//) return "tools";
        if (path ~ /^tsz\/carts\//) return "carts";
        if (path ~ /^tsz\/scripts\//) return "scripts";
        if (path ~ /^tsz\/docs\//) return "docs";
        if (path ~ /^tsz\/tests\//) return "tests";
        if (path ~ /^tsz\/(plans|research|stb|tsz|web|wgpu_web|witnesses|screenshots)\//) return "support";
        if (path ~ /^tsz\/[^\/]+$/) return "root";
        return "other";
      }

      function is_ignored(path) {
        return path == "" ||
          path ~ /^tsz\/carts\/conformance\/\.verified\// ||
          path ~ /\/\.verified\// ||
          path ~ /\/\.zig-cache\// ||
          path ~ /\/\.zig-global-cache\// ||
          path ~ /\/\.tsz-preflight\// ||
          path ~ /\/zig-cache\// ||
          path ~ /\/zig-out\// ||
          path ~ /^tsz\/screenshots\// ||
          path ~ /^tsz\/tests\/screenshots\// ||
          path ~ /^tsz\/\.claude\// ||
          ends_with(path, ".gen.zig");
      }

      /^DATE / {
        day = $2;
        next;
      }

      NF > 0 {
        path = $0;
        gsub(/\r/, "", path);
        if (is_ignored(path)) next;

        fresh_day[day] = (fresh_day[day] + 0) + 1;

        area = area_of(path);
        area_add[area] = (area_add[area] + 0) + 1;
        if (area_first[area] == "" || day < area_first[area]) area_first[area] = day;
        if (area_last[area] == "" || day > area_last[area]) area_last[area] = day;

        if (day >= cutoff_day) {
          fresh_total += 1;
          fresh_list_count += 1;
          if (fresh_list_count <= 18) {
            print "FRESH_FILE\t" fresh_list_count "\t" day "\t" area "\t" path;
          }
        }
      }

      END {
        print "FRESH\t" fresh_total;
        for (a in fresh_day) print "FRESH_DAY\t" a "\t" fresh_day[a];
        for (a in area_add) print "AREA\t" a "\t" area_add[a] "\t" area_first[a] "\t" area_last[a];
      }
    '
}

emit_recent_edits() {
  if [ ! -d "$TRAIL_ROOT/.git" ]; then
    echo "ERR\tmissing_trail_repo\t$TRAIL_ROOT"
    exit 1
  fi

  git -C "$TRAIL_ROOT" log --no-merges --max-count="$LIMIT" --date=unix --pretty='RECENT_EDIT\t%h\t%ct\t%an\t%s' 2>/dev/null \
    | awk -F '\t' '
      NF >= 5 {
        msg = $5;
        for (i = 6; i <= NF; i = i + 1) {
          msg = msg " " $i;
        }
        gsub(/\t/, " ", msg);
        gsub(/\r/, "", msg);
        print "RECENT_EDIT\t" $3 "\t" $2 "\t" $4 "\t" strftime("%Y-%m-%d %H:%M:%S", $3) "\t" msg;
      }
    '
}

emit_restore_points() {
  if [ ! -d "$TRAIL_ROOT/.git" ]; then
    echo "ERR\tmissing_trail_repo\t$TRAIL_ROOT"
    exit 1
  fi

  git -C "$TRAIL_ROOT" log --no-merges --max-count="$LIMIT" --date=unix --regexp-ignore-case --perl-regexp --grep='restore|restore-point|checkpoint|autosave|snapshot' \
    --pretty='RESTORE\t%h\t%ct\t%an\t%s' 2>/dev/null \
    | awk -F '\t' '
      NF >= 5 {
        msg = $5;
        for (i = 6; i <= NF; i = i + 1) {
          msg = msg " " $i;
        }
        gsub(/\t/, " ", msg);
        gsub(/\r/, "", msg);
        print "RESTORE\t" (NR) "\t" $2 "\t" $3 "\t" strftime("%Y-%m-%d %H:%M:%S", $3) "\t" $4 "\t" msg;
      }
    '
}

emit_worker_lag() {
  if [ ! -d "$TRAIL_ROOT/.git" ]; then
    echo "ERR\tmissing_trail_repo\t$TRAIL_ROOT"
    exit 1
  fi

  git -C "$TRAIL_ROOT" log --no-merges --max-count="$LIMIT" --date=unix --pretty='LAG\t%an\t%h\t%ct\t%s' 2>/dev/null \
    | awk -F '\t' -v now_epoch="$NOW_EPOCH" -v warn="$LAG_WARN_SECONDS" -v critical="$LAG_CRITICAL_SECONDS" '
      {
        if ($1 != "LAG" || NF < 5) next;

        worker = $2;
        sha = $3;
        epoch = $4 + 0;
        if (epoch == 0) next;

        updates = updates[worker] + 1;

        if (first_ts[worker] == "" || epoch > first_ts[worker]) {
          first_ts[worker] = epoch;
          first_sha[worker] = sha;
          first_subject[worker] = $5;
          for (i = 6; i <= NF; i = i + 1) {
            first_subject[worker] = first_subject[worker] " " $i;
          }
        }
      }

      END {
        for (worker in first_ts) {
          lag = now_epoch - first_ts[worker];
          if (lag < 0) lag = 0;
          status = "clean";
          if (lag > critical) status = "critical";
          else if (lag > warn) status = "stale";

          uncommitted = (status == "clean") ? 0 : 1;
          print "WORKER_LAG\t" worker "\t" first_sha[worker] "\t" first_ts[worker] "\t" strftime("%Y-%m-%d %H:%M:%S", first_ts[worker]) "\t" lag "\t" status "\t" updates[worker] "\t" uncommitted;
        }
      }
    '
}

case "$MODE" in
  commits)
    emit_commit_overview
    ;;
  recent-edits)
    emit_recent_edits
    ;;
  restore-points)
    emit_restore_points
    ;;
  worker-lag)
    emit_worker_lag
    ;;
  *)
    echo "ERR\tunsupported_mode\t$MODE"
    exit 1
    ;;
esac
