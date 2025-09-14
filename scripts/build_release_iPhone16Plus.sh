#!/usr/bin/env bash
# Build iHafidh iOS app (Release, Simulator iPhone 16 Plus) with logging & refined error filtering.
# Usage:
#   bash scripts/build_release_iPhone16Plus.sh        # build only
#   LAUNCH=1 bash scripts/build_release_iPhone16Plus.sh  # build + install + launch
#   BUNDLE_ID_OVERRIDE=com.ihafidh LAUNCH=1 bash scripts/build_release_iPhone16Plus.sh

set -u
set -o pipefail

IOS_DIR="$(cd "$(dirname "$0")/.." && pwd)/ios"
WORKSPACE="iHafidh.xcworkspace"
SCHEME="iHafidh"
CONFIG="Release"
DEST_NAME="iPhone 16 Plus"
DERIVED_DATA="/tmp/iHafidhDerivedData"
BUILD_LOG="/tmp/build_release_iPhone16Plus.log"
ERROR_LOG="/tmp/build_errors_iPhone16Plus.log"

BUNDLE_ID_OVERRIDE="${BUNDLE_ID_OVERRIDE:-}"

info() { printf "[INFO] %s\n" "$*"; }
warn() { printf "[WARN] %s\n" "$*"; }
err()  { printf "[ERROR] %s\n" "$*"; }

if [ ! -d "$IOS_DIR" ]; then
  err "iOS directory not found: $IOS_DIR"; exit 1; fi
cd "$IOS_DIR"

if [ ! -d "$WORKSPACE" ]; then
  err "Workspace directory '$WORKSPACE' not found in $IOS_DIR";
  warn "Run: npx expo prebuild --platform ios"; exit 1; fi

info "Cleaning previous DerivedData at $DERIVED_DATA"
rm -rf "$DERIVED_DATA"; mkdir -p "$DERIVED_DATA"
: > "$BUILD_LOG"; : > "$ERROR_LOG"

info "Ensuring simulator '$DEST_NAME' exists (will not fail if missing)"
if ! xcrun simctl list devices | grep -F "${DEST_NAME} (" >/dev/null 2>&1; then
  RUNTIME=$(xcrun simctl list runtimes | awk -F '[()]' '/iOS/{print $2}' | tail -1)
  DEVICE_TYPE="com.apple.CoreSimulator.SimDeviceType.iPhone-16-Plus"
  if [ -n "$RUNTIME" ]; then xcrun simctl create "$DEST_NAME" "$DEVICE_TYPE" "$RUNTIME" >/dev/null 2>&1 || true; fi
fi
DESTINATION="platform=iOS Simulator,name=${DEST_NAME}"

info "Starting Release build for $SCHEME ($DESTINATION)"
{
  echo "===== BUILD START: $(date) =====";
  echo "xcodebuild -workspace $WORKSPACE -scheme $SCHEME -configuration $CONFIG -destination '$DESTINATION' -derivedDataPath $DERIVED_DATA";
} >> "$BUILD_LOG"

set +e
/usr/bin/time -l xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIG" \
  -destination "$DESTINATION" \
  -derivedDataPath "$DERIVED_DATA" \
  -UseModernBuildSystem=YES \
  build 2>&1 | tee -a "$BUILD_LOG"
BUILD_EXIT=${PIPESTATUS[0]}
set -e

# Refined error extraction (avoid noisy symbols like generic Exception lines)
awk 'BEGIN{IGNORECASE=1}' \
    '/error:|fatal error:|ld: error:|Undefined symbols for architecture|BUILD FAILED|Command CompileSwift failed|The following build commands failed:/' "$BUILD_LOG" \
  | grep -v 'didCompleteWithError' \
  | grep -v 'Exception.swift' \
  | sed '/^$/d' > "$ERROR_LOG" || true

ERROR_COUNT=$(wc -l < "$ERROR_LOG" | tr -d ' ')

if [ "$BUILD_EXIT" -ne 0 ]; then err "xcodebuild exited with code $BUILD_EXIT"; fi
if [ "$ERROR_COUNT" -gt 0 ]; then err "Detected $ERROR_COUNT critical build error lines (see $ERROR_LOG)"; else info "No critical error patterns detected."; fi

APP_PATH="$DERIVED_DATA/Build/Products/${CONFIG}-iphonesimulator/${SCHEME}.app"
if [ "$BUILD_EXIT" -eq 0 ] && [ -d "$APP_PATH" ]; then info "Build SUCCESS: $APP_PATH"; else err "Build FAILED."; exit 1; fi

if [ "${LAUNCH:-0}" = "1" ]; then
  info "Booting simulator & launching app"
  xcrun simctl boot "$DEST_NAME" >/dev/null 2>&1 || true
  xcrun simctl bootstatus "$DEST_NAME" -b || true
  BUNDLE_ID="$BUNDLE_ID_OVERRIDE";
  if [ -z "$BUNDLE_ID" ]; then
    if [ -f "$APP_PATH/Info.plist" ]; then BUNDLE_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_PATH/Info.plist" 2>/dev/null || true); fi
  fi
  if [ -z "$BUNDLE_ID" ]; then warn "Bundle id unresolved. Set BUNDLE_ID_OVERRIDE to launch."; exit 0; fi
  xcrun simctl uninstall "$DEST_NAME" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl install "$DEST_NAME" "$APP_PATH" || { err "Install failed"; exit 1; }
  xcrun simctl launch "$DEST_NAME" "$BUNDLE_ID" || warn "Launch failed"
  info "Launched $BUNDLE_ID on $DEST_NAME"
else
  info "Skipping launch (set LAUNCH=1 to auto-run)."
fi

info "Logs: $BUILD_LOG (full) | $ERROR_LOG (errors)"
exit 0