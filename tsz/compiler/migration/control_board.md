# Migration Control Board

## 001-020 Loop Discipline

loop_discipline_explicit: true

## 021-050 Workspace Scaffolding

manifest_names_proposal_as_source_of_truth: true

all_scaffold_paths_exist: true

observed_scaffold_paths:
- migration/
- migration/contracts/
- migration/harness/
- migration/harness/fixtures/
- migration/harness/output/
- migration/harness/output/parity/
- migration/harness/output/split/
- migration/harness/output/tmp/
- migration/reports/
- migration/reports/coverage/
- migration/reports/live_risks/
- migration/reports/parity/
- migration/reports/sections/
- migration/reports/split/
- migration/state/

missing_scaffold_paths: none

## 051-080 Canonical Source Capture

canonical_snapshots_readable_and_complete: true

source_index_missing_hub_file: false

all_canonical_artifacts_exist: true

checked_canonical_files:
- canonical_manifest_snapshot.md
- canonical_final_cut_snapshot.md
- canonical_decomposition_snapshot.md
- canonical_reuse_snapshot.md
- canonical_orchestration_snapshot.md
- canonical_git_status.txt
- source_index.md

missing_canonical_artifacts: none

## 081-110 Harness Scaffolding

harness_scaffold_complete: true
