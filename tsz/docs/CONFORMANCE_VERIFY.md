# Conformance Verification

Human-only process. Claude cannot verify, override, or edit verified test sources.

## Quick Reference

```bash
cd tsz

# Build a test first
./scripts/build carts/conformance/mixed/d01_nested_maps.tsz

# Run the binary, check it looks right
./zig-out/bin/d01_nested_maps

# If it works, verify it (locks source hash + snapshots generated code)
./scripts/conformance-report --verify d01_nested_maps

# Check what's been verified
./scripts/conformance-report --verified

# Full summary (shows verified count per lane)
./scripts/conformance-report
```

## What --verify Does

1. Stamps `verified_at` on the latest build row in `conformance.db`
2. Locks the source `.tsz` file hash in the `verified_sources` table
3. Snapshots the generated .zig files to `carts/conformance/.verified/<test_name>/`

After verification, if ANY Claude session edits the `.tsz` source, the build script will block with `TAMPER DETECTED` and refuse to compile.

## Source Tamper Protection

When a verified test's source changes, the build prints:

```
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  TAMPER DETECTED: test_name
  ...
  If the source change is legitimate, the HUMAN must run:
    ./scripts/conformance-report --override test_name
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
```

Only `--override` can unlock it:

```bash
# Accept a legitimate source change (re-locks with new hash)
./scripts/conformance-report --override d01_nested_maps
```

After override, rebuild and re-verify:

```bash
./scripts/build carts/conformance/mixed/d01_nested_maps.tsz
./zig-out/bin/d01_nested_maps
./scripts/conformance-report --verify d01_nested_maps
```

## Diffing Against Verified Snapshots

If the compiler regresses, diff current output against the verified snapshot:

```bash
diff carts/conformance/.verified/d01_nested_maps/ /tmp/tsz-gen/generated_d01_nested_maps/
```

## Other Report Commands

```bash
./scripts/conformance-report              # summary
./scripts/conformance-report --all        # every test with status + verified date
./scripts/conformance-report --fails      # failures + untested
./scripts/conformance-report --lane mixed # filter by lane
./scripts/conformance-report --untested   # never-attempted tests
```
