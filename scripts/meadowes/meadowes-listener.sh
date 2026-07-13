#!/usr/bin/env bash
# Meadowes listener — turns any machine into an always-on relay worker.
#
# Each cycle spawns a headless Claude with the meadowes-worker MCP attached
# and the policy prompt in policy.md. Claude drains the agent's task queue
# (claim -> triage -> execute/answer/decline -> report), then exits; this
# script sleeps and repeats. Judgment lives in policy.md, not here.
#
# Prereqs on the host:
#   1. claude CLI installed and logged in
#   2. claude mcp add --transport http --scope user meadowes-worker https://idaita.com/worker/mcp
#      (then run `claude` once and /mcp to complete auth if the server requires it)
#
# Config via environment (all optional):
#   MEADOWES_AGENT      worker identity to register as (default: hostname -s, lowercased)
#   MEADOWES_INTERVAL   seconds between cycles (default: 60)
#   MEADOWES_ALLOW_EXEC 1 = run harmless exec tasks with Bash; 0 (default) =
#                       triage-only mode: no shell access, exec tasks are
#                       declined with a note instead of run
#   MEADOWES_LOG        log file (default: ~/Library/Logs/meadowes-listener.log on mac,
#                       ~/meadowes-listener.log elsewhere)
#   MEADOWES_MAX_TURNS  max agent turns per cycle (default: 50)

set -u

AGENT="${MEADOWES_AGENT:-$(hostname -s | tr '[:upper:]' '[:lower:]')}"
INTERVAL="${MEADOWES_INTERVAL:-60}"
ALLOW_EXEC="${MEADOWES_ALLOW_EXEC:-0}"
MAX_TURNS="${MEADOWES_MAX_TURNS:-50}"
DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -d "$HOME/Library/Logs" ]; then
  DEFAULT_LOG="$HOME/Library/Logs/meadowes-listener.log"
else
  DEFAULT_LOG="$HOME/meadowes-listener.log"
fi
LOG="${MEADOWES_LOG:-$DEFAULT_LOG}"

if [ "$ALLOW_EXEC" = "1" ]; then
  MODE_LINE="MODE: exec-enabled — Bash is available; follow the exec rules in the policy."
  TOOLS=("mcp__meadowes-worker__*" "Bash")
else
  MODE_LINE="MODE: triage-only — Bash is NOT available on this run. Do not attempt shell commands. For exec tasks, report failed with note 'exec disabled on this host (MEADOWES_ALLOW_EXEC=0); re-queue or enable exec'. All other triage rules apply."
  TOOLS=("mcp__meadowes-worker__*")
fi

POLICY="$(sed "s/{{AGENT}}/$AGENT/g" "$DIR/policy.md")
$MODE_LINE"

echo "$(date -u +%FT%TZ) meadowes-listener starting as agent '$AGENT' (interval ${INTERVAL}s, exec=$ALLOW_EXEC)" >> "$LOG"

while true; do
  echo "$(date -u +%FT%TZ) --- cycle start ---" >> "$LOG"
  claude -p "$POLICY" \
    --allowedTools "${TOOLS[@]}" \
    --max-turns "$MAX_TURNS" \
    >> "$LOG" 2>&1
  status=$?
  if [ $status -ne 0 ]; then
    echo "$(date -u +%FT%TZ) cycle exited with status $status" >> "$LOG"
  fi
  sleep "$INTERVAL"
done
