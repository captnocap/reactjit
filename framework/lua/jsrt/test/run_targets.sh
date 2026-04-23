#!/usr/bin/env bash
# Run all JSRT target tests. Exits 0 if every present target passes, else with
# the count of failures. Missing targets (pending per TARGET.md) are reported
# as pending and do not count toward failures.
#
# From repo root or anywhere: ./framework/lua/jsrt/test/run_targets.sh

set -u

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$here/../../../.." && pwd)"
cd "$repo_root"

pass=0
fail=0
total=0

# Every target expected by TARGET.md. Edit this list when adding targets.
targets=(
  "01_literals_and_binding"
  "02_function_and_call"
  "03_closures_and_mutation"
  "04_objects_and_dot_access"
  "05_arrays_and_iteration"
  "06_classes_and_new"
  "07_try_catch"
  "08_map_and_set"
  "09_host_ffi_call"
  "10_ast_preparser_bridge"
  "11_real_react_createElement"
  "12_useState_counter"
  "13_sweatshop_file_click"
)

printf '%-4s %-32s %s\n' "num" "target" "status"
printf '%-4s %-32s %s\n' "---" "------" "------"

for name in "${targets[@]}"; do
  total=$((total + 1))
  file="framework/lua/jsrt/test/target_${name}.lua"
  num="${name%%_*}"
  title="${name#*_}"
  if [ -f "$file" ]; then
    output=$(luajit "$file" 2>&1)
    if [ $? -eq 0 ]; then
      pass=$((pass + 1))
      printf '%-4s %-32s %s\n' "$num" "$title" "PASS"
    else
      fail=$((fail + 1))
      printf '%-4s %-32s %s\n' "$num" "$title" "FAIL"
      echo "$output" | head -5 | sed 's/^/      /'
    fi
  else
    printf '%-4s %-32s %s\n' "$num" "$title" "pending"
  fi
done

echo ""
echo "JSRT status: $pass/$total targets passing"

exit $fail
