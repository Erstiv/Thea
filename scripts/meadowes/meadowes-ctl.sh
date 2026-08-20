#!/usr/bin/env bash
# meadowes-ctl.sh <plist-label> <pause|resume|exec-on|exec-off|state>
# Controls a Meadowes launchd job on THIS machine. Called locally by the
# dashboard (Plex jobs) or over ssh (M5 persona jobs).
set -euo pipefail
LABEL="${1:?usage: meadowes-ctl.sh <label> <action>}"
ACTION="${2:?}"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
[ -f "$PLIST" ] || { echo "no plist $PLIST"; exit 1; }

case "$ACTION" in
  pause)  launchctl unload "$PLIST" 2>/dev/null || true; echo "paused $LABEL" ;;
  resume) launchctl load -w "$PLIST"; echo "resumed $LABEL" ;;
  exec-on|exec-off)
    VAL=1; [ "$ACTION" = "exec-off" ] && VAL=0
    /usr/bin/sed -i '' \
      "s#<key>MEADOWES_ALLOW_EXEC</key><string>[01]</string>#<key>MEADOWES_ALLOW_EXEC</key><string>${VAL}</string>#" \
      "$PLIST"
    launchctl unload "$PLIST" 2>/dev/null || true
    launchctl load -w "$PLIST"
    echo "MEADOWES_ALLOW_EXEC=${VAL} for $LABEL (reloaded)" ;;
  state)
    # no `grep -q`: early-exit + pipefail turns SIGPIPE'd launchctl into a false "not running"
    RUN=no
    if launchctl list 2>/dev/null | grep -F "$LABEL" >/dev/null; then RUN=yes; fi
    EX=$(grep -A1 MEADOWES_ALLOW_EXEC "$PLIST" 2>/dev/null | grep -oE '<string>[01]</string>' | grep -oE '[01]' | head -1 || true)
    echo "running=$RUN exec=${EX:-na}" ;;
  *) echo "unknown action $ACTION"; exit 1 ;;
esac
