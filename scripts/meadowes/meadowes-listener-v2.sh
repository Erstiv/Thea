#!/usr/bin/env bash
# Meadowes listener v2 — PERSISTENT single-session worker.
#
# v1 spawned a fresh one-shot Claude every INTERVAL seconds: no memory across
# tasks, and a heavy task could blow the turn budget and die mid-work leaving
# an orphaned claim. v2 runs ONE long-lived Claude session that joins once and
# then long-polls the queue continuously, handling task after task in a single
# context, until it has been idle a while — then it exits cleanly and this
# wrapper immediately respawns it (fresh memory, same identity). One claimer
# per agent, near-instant pickup, continuity within a run.
#
# Config via environment (all optional):
#   MEADOWES_AGENT            identity (default: hostname -s lowercased)
#   MEADOWES_ALLOW_EXEC       1 = Bash available; 0 (default) = triage-only
#   MEADOWES_MODEL            model for the session (default: claude CLI default)
#   MEADOWES_MCP_CONFIG       explicit per-agent MCP config (bearer). If unset,
#                             falls back to the cwd's project .mcp.json.
#   MEADOWES_MAX_TURNS        turn budget for one persistent run (default: 400)
#   MEADOWES_IDLE_EXIT_POLLS  consecutive empty long-polls before a clean exit
#                             and respawn (default: 10 ≈ 20 min at 120s polls)
#   MEADOWES_LOG              log file

set -u

AGENT="${MEADOWES_AGENT:-$(hostname -s | tr '[:upper:]' '[:lower:]')}"
ALLOW_EXEC="${MEADOWES_ALLOW_EXEC:-0}"
MAX_TURNS="${MEADOWES_MAX_TURNS:-400}"
IDLE_EXIT_POLLS="${MEADOWES_IDLE_EXIT_POLLS:-10}"
MODEL="${MEADOWES_MODEL:-}"
MCP_CONFIG="${MEADOWES_MCP_CONFIG:-}"
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

LOOP_BLOCK="## Persistent session mode (overrides the one-shot Procedure above)

You are a LONG-LIVED worker for this run, not a single cycle. Concretely:

1. Call join() exactly once at the start.
2. Then loop:
   a. Call next_task(timeout_s=120).
   b. If it returns a task: handle it per the triage rules, call report() with
      an honest result, then loop again IMMEDIATELY — more work may be queued.
   c. If it returns null: call heartbeat(), then loop again.
3. Keep looping so freshly-dispatched tasks are claimed within seconds. Exit the
   loop cleanly ONLY when next_task has returned null ${IDLE_EXIT_POLLS} times in
   a row (you have been idle long enough), or you are within ~20 turns of your
   budget. On exit, print one line: 'persistent session ending — idle' or
   'persistent session ending — turn budget'. The wrapper restarts you at once,
   so an idle exit is free and keeps your memory fresh.

Because you persist across tasks within one run, you REMEMBER what you just did.
Use that continuity: don't re-verify the same file or re-read the same memo you
checked a task ago. Never exit while a task is claimed-but-unreported — every
claimed task gets a report() first, always."

# Persistent mode leads the prompt and explicitly supersedes the one-shot
# "work once then stop" language in policy.md, so precedence is unambiguous
# regardless of model tier.
POLICY="IMPORTANT — READ FIRST. This run uses PERSISTENT SESSION MODE, defined
immediately below. Wherever the policy that follows says to work the queue
'once' and then 'stop'/'exit' (its Procedure section), that is SUPERSEDED: you
do NOT exit after one pass. You long-poll and handle tasks continuously until
idle, per the rules here.

$LOOP_BLOCK

======================================================================
Base policy (triage rules, authorization, conduct) follows. Obey all of it
EXCEPT the one-shot exit cadence, which the block above overrides.
======================================================================

$(sed "s/{{AGENT}}/$AGENT/g" "$DIR/policy.md")

--- AUTHORIZATION.md (trust anchor, included verbatim) ---

$(cat "$DIR/AUTHORIZATION.md")

$MODE_LINE"

CLAUDE_ARGS=(-p "$POLICY" --allowedTools "${TOOLS[@]}" --max-turns "$MAX_TURNS")
[ -n "$MODEL" ] && CLAUDE_ARGS+=(--model "$MODEL")
[ -n "$MCP_CONFIG" ] && CLAUDE_ARGS+=(--mcp-config "$MCP_CONFIG" --strict-mcp-config)

echo "$(date -u +%FT%TZ) meadowes-listener-v2 starting as agent '$AGENT' (persistent; max_turns=${MAX_TURNS}, idle_exit=${IDLE_EXIT_POLLS} polls, exec=$ALLOW_EXEC)" >> "$LOG"

while true; do
  echo "$(date -u +%FT%TZ) --- persistent session start ---" >> "$LOG"
  claude "${CLAUDE_ARGS[@]}" >> "$LOG" 2>&1
  status=$?
  echo "$(date -u +%FT%TZ) --- persistent session exited (status $status) ---" >> "$LOG"
  # Short respawn delay so a crash-loop can't spin hot; a clean idle exit also
  # pauses here briefly before the next long-lived session begins.
  sleep 5
done
