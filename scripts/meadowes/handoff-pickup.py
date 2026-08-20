#!/usr/bin/env python3
"""SessionStart hook — if the working directory has a HANDOFF_latest.md,
inject it so a fresh session wakes up already briefed."""
import json
import os
import sys

try:
    hook = json.load(sys.stdin)
    cwd = hook.get("cwd") or os.getcwd()
    path = os.path.join(cwd, "HANDOFF_latest.md")
    if os.path.exists(path):
        with open(path, encoding="utf-8", errors="replace") as f:
            body = f.read()[:30000]
        msg = ("📋 HANDOFF FROM YOUR PREDECESSOR (auto-loaded from "
               f"{path}). Read it before answering; it is your starting state:\n\n{body}")
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "SessionStart", "additionalContext": msg}}))
except Exception:
    sys.exit(0)
