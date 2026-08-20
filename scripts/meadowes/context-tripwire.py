#!/usr/bin/env python3
"""UserPromptSubmit hook — context-fullness tripwire.
Reads hook JSON on stdin, estimates the session's context fullness from its
transcript (text bytes since last compaction, base64 images discounted), and
past TRIP_PCT injects a directive to write the persona's handoff.
Fast path: scans at most the final TAIL_MB of the transcript.
Silent (no output) below threshold.
"""
import json
import os
import re
import sys

CAL_FULL_MB = float(os.environ.get("CAL_FULL_MB", "10"))
TRIP_PCT = float(os.environ.get("TRIP_PCT", "85"))
TAIL_MB = 32
MARKER = b"compact_boundary"
B64RUN = re.compile(rb"[A-Za-z0-9+/=]{4096,}")

try:
    hook = json.load(sys.stdin)
    path = hook.get("transcript_path", "")
    if not path or not os.path.exists(path):
        sys.exit(0)
    size = os.path.getsize(path)
    start = max(0, size - TAIL_MB * 1048576)
    text, last = 0, -1
    with open(path, "rb") as f:
        f.seek(start)
        data = f.read()
    i = data.rfind(MARKER)
    if i != -1:
        data = data[i:]
    b64 = sum(len(m) for m in B64RUN.findall(data))
    text = len(data) - b64 + (b64 // 1300) * 60
    pct = 100 * (text / 1048576) / CAL_FULL_MB
    if pct >= TRIP_PCT:
        msg = (f"⚠️ CONTEXT TRIPWIRE: this session's context window is ~{pct:.0f}% full "
               f"(estimated). Per Elliot's standing instruction: FINISH the current small step, "
               f"then write a comprehensive handoff to HANDOFF_latest.md in your working "
               f"directory (state, not story: what's true now, what's mid-flight, what's "
               f"blocked, key paths/IDs). Replace the old file. Then tell Elliot: "
               f"\"Handoff written — start a fresh session when ready; it will auto-load.\"")
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit", "additionalContext": msg}}))
except Exception:
    sys.exit(0)
