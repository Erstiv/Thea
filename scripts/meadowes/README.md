# Meadowes listener

Retires the human courier: a daemon that polls the Meadowes broker
(`https://idaita.com/worker/mcp`) for tasks addressed to this machine's agent,
lets a headless Claude triage them with judgment (see `policy.md`), executes
what's safe, declines what isn't, and reports every outcome back to the board.

Born 2026-07-12 after the Crouch relay tests proved the broker + worker API
work end-to-end but nothing was ever polling the queue (plex `last_seen: null`,
tasks expiring unclaimed).

## Files

| File | Purpose |
|------|---------|
| `meadowes-listener.sh` | The poll loop. Spawns `claude -p` per cycle with `policy.md` as the prompt. |
| `policy.md` | Triage rules: drain stale tasks, verify alerts, run harmless exec, never auto-run outward-facing/destructive work. |
| `com.meadowes.listener.plist` | launchd job for the Plex Mac (agent `plex`). |
| `meadowes-listener.service` | systemd unit for filou (agent `filou`). |

## Setup on the Plex Mac

```bash
# 1. Get the repo onto the machine (or just these four files)
git clone <thea-repo> ~/Thea   # or git pull if it's already there

# 2. Wire up the worker MCP for the claude CLI (user scope so -p runs see it)
claude mcp add --transport http --scope user meadowes-worker https://idaita.com/worker/mcp
# If the broker needs auth, open `claude`, run /mcp, complete the flow once.

# 3. Test one cycle in the foreground before daemonizing
chmod +x ~/Thea/scripts/meadowes/meadowes-listener.sh
MEADOWES_AGENT=plex ~/Thea/scripts/meadowes/meadowes-listener.sh
# (starts in triage-only mode: no shell, exec tasks declined with a note.
#  Once happy, add MEADOWES_ALLOW_EXEC=1 to enable unattended exec.)
# Watch the log; Ctrl-C when satisfied:
tail -f ~/Library/Logs/meadowes-listener.log

# 4. Install as launchd job (edit paths in the plist first if needed)
cp ~/Thea/scripts/meadowes/com.meadowes.listener.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.meadowes.listener.plist
```

`RunAtLoad` + `KeepAlive` + the Mac's no-sleep setting = 24/7 listener that
survives crashes and reboots.

## Setup on filou

```bash
cd /opt/thea && git pull
claude mcp add --transport http --scope user meadowes-worker https://idaita.com/worker/mcp
cp scripts/meadowes/meadowes-listener.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now meadowes-listener
journalctl -u meadowes-listener -f
```

## Notes / known constraints

- The broker queue is strict FIFO with no fetch-by-id; the policy tells the
  worker to report every task (done/failed/cancelled) so the queue never
  clogs behind a zombie again.
- Task `expires_at` is advisory — the broker allows claiming expired tasks.
  The policy cancels them with a note instead of running them.
- **Exec is off by default** (`MEADOWES_ALLOW_EXEC=0`): the listener triages,
  answers chat, and drains stale tasks but has no shell and declines exec
  tasks with a note. Flip to `1` per machine (plist / service file) once
  you've watched a few cycles. With exec on, Claude runs `Bash` with no human
  in the loop — that is the point (auto_execute), but it means: only enable it
  where the agent's queue is trusted, and keep the outward-facing /
  destructive prohibitions in `policy.md` intact.
- Personas (Max/Corinne/Muse) are interactive seats, not this daemon. The
  daemon handles queue hygiene, harmless exec, and chat replies; anything
  that needs a persona's judgment gets declined with a pointer instead.
