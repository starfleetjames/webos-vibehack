#!/usr/bin/env bash
# Run home-watch.py in the background on this Mac: starts at login, restarts if it stops.
#   TV_HOST=192.168.1.50 ./home-watch-mac.sh            # install / update
#   ./home-watch-mac.sh uninstall
# Log: ~/Library/Logs/tv-vibehack-home-watch.log
set -euo pipefail
cd "$(dirname "$0")"
LABEL=com.tvvibehack.homewatch
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/tv-vibehack-home-watch.log"
SERVICE_DIR="$HOME/Library/Application Support/webos-vibehack"
umask 077

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if [ "${1:-}" = uninstall ]; then
  rm -f "$PLIST"
  echo "Removed. Home opens LG's home again."
  exit 0
fi

: "${TV_HOST:?set TV_HOST to the TV IP address, e.g. TV_HOST=192.168.1.50 $0}"
# Keep the unattended runtime outside Documents, which macOS protects separately.
# The checkout remains the source for future installations and app syncs.
mkdir -p "$SERVICE_DIR"
chmod 700 "$SERVICE_DIR"
[ -x "$SERVICE_DIR/venv/bin/python" ] || python3 -m venv "$SERVICE_DIR/venv"
"$SERVICE_DIR/venv/bin/python" -m pip install --disable-pip-version-check -q 'websockets==17.4'
install -m 600 home-watch.py lgtv.py movie_watchlist.py "$SERVICE_DIR/"
[ ! -f .lgtv-key.json ] || install -m 600 .lgtv-key.json "$SERVICE_DIR/.lgtv-key.json"

mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>AssociatedBundleIdentifiers</key>
  <array><string>org.python.python</string></array>
  <key>ProgramArguments</key>
  <array>
    <string>$SERVICE_DIR/venv/bin/python</string>
    <string>-u</string>
    <string>$SERVICE_DIR/home-watch.py</string>
    <string>$TV_HOST</string>
  </array>
  <key>WorkingDirectory</key><string>$SERVICE_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Running. Press Home on the remote. Log: $LOG"
