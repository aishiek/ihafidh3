#!/usr/bin/env bash
# Cleanup build + crash logs related to iHafidh to reduce confusion.
# Safe: only targets known temp build outputs & matching crash reports.
# Usage: bash scripts/cleanup_logs.sh
set -euo pipefail

APP_PATTERNS=(iHafidh TypeToSiriWidgetExtension)
TMP_FILES=(/tmp/build_release_iPhone16Plus.log /tmp/build_errors_iPhone16Plus.log)
DERIVED_DATA=/tmp/iHafidhDerivedData
CRASH_DIR=~/Library/Logs/DiagnosticReports

echo "[cleanup] Removing tmp build logs if present" 
for f in "${TMP_FILES[@]}"; do
  if [ -f "$f" ]; then rm -f "$f" && echo "  deleted $f"; else echo "  missing $f"; fi
done

echo "[cleanup] Removing DerivedData (if exists)"
if [ -d "$DERIVED_DATA" ]; then
  rm -rf "$DERIVED_DATA" && echo "  removed $DERIVED_DATA"
else
  echo "  no DerivedData dir"
fi

echo "[cleanup] Pruning old crash reports (keeping 1 most recent per pattern)"
if [ -d "$CRASH_DIR" ]; then
  for patt in "${APP_PATTERNS[@]}"; do
    # List all crash logs matching pattern (sorted newest first)
    all_matches=$(ls -1t "$CRASH_DIR" 2>/dev/null | grep -F "$patt" || true)
    keep=1
    count=0
    if [ -n "$all_matches" ]; then
      echo "$all_matches" | while IFS= read -r file; do
        if [ -z "$file" ]; then continue; fi
        count=$((count+1))
        if [ $count -le $keep ]; then
          echo "  keep $file"
        else
          rm -f "$CRASH_DIR/$file" && echo "  removed $CRASH_DIR/$file" || true
        fi
      done
    else
      echo "  no crash logs for $patt"
    fi
  done
else
  echo "  crash reports directory not found: $CRASH_DIR"
fi

echo "[cleanup] Done."
