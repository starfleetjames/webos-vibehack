#!/usr/bin/env bash
# Build/install the read-only Reminders helper; synchronize the selected TV watchlist at login and every minute.
# Run the installed app once to authorize Reminders before enabling its LaunchAgent.
set -euo pipefail
cd "$(dirname "$0")"
SERVICE_DIR="$HOME/Library/Application Support/webos-vibehack"
APP="$SERVICE_DIR/TV Watchlist.app"
LABEL=com.tvvibehack.watchlist
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/tv-vibehack-watchlist.log"
umask 077

if [ "${1:-}" = uninstall ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  [ ! -f "$PLIST" ] || mv "$PLIST" "$PLIST.disabled"
  echo "Automatic TV watchlist syncing is disabled. Reminders are unchanged."
  exit 0
fi

if [ "${1:-}" = build ]; then
  mkdir -p "$APP/Contents/MacOS"
  cp mac/Watchlist-Info.plist "$APP/Contents/Info.plist"
  xcrun swiftc -O -module-cache-path "${TMPDIR:-/tmp}/tv-watchlist-swift-cache" \
    -framework AppKit -framework EventKit mac/Watchlist.swift -o "$APP/Contents/MacOS/TVWatchlist"
  codesign --force --sign - --identifier "$LABEL" "$APP"
  echo "Built $APP"
  exit 0
fi

[ -x "$APP/Contents/MacOS/TVWatchlist" ] || { echo "Build and authorize the TV Watchlist app first." >&2; exit 1; }
python3 - "$SERVICE_DIR/watchlist-status.json" <<'PY'
import json, sys
try:
    assert json.load(open(sys.argv[1])).get('status') == 'ok'
except (OSError, ValueError, AssertionError):
    sys.exit('Authorize TV Watchlist and complete a successful sync before enabling it at login.')
PY
mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
python3 - "$PLIST" "$APP" "$LABEL" "$LOG" <<'PY'
import plistlib, sys
path, app, label, log = sys.argv[1:]
with open(path, 'wb') as f:
    plistlib.dump({
        'Label': label,
        'AssociatedBundleIdentifiers': [label],
        'ProgramArguments': [app + '/Contents/MacOS/TVWatchlist'],
        'RunAtLoad': True, 'StartInterval': 60, 'ProcessType': 'Background',
        'StandardOutPath': log, 'StandardErrorPath': log,
    }, f)
PY
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "the selected TV watchlist syncs every minute; updated titles reach the TV when Home opens."
