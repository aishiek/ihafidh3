#!/usr/bin/env bash
set -euo pipefail

# Remove legacy /qibla.tsx single-file route now that folder route exists
if [ -f "app/qibla.tsx" ]; then
  rm app/qibla.tsx
  echo "Removed app/qibla.tsx"
else
  echo "app/qibla.tsx already removed"
fi

echo "Clearing Metro + build caches (node_modules untouched)..."
# Remove Expo + RN cache dirs
rm -rf $TMPDIR/metro-* || true
rm -rf $TMPDIR/haste-map-* || true
rm -rf .expo/.cache || true

# Optional: clean iOS derived data (uncomment if needed)
# rm -rf ~/Library/Developer/Xcode/DerivedData/*

echo "Done. Now run: npx expo start -c"
