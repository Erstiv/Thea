#!/usr/bin/env python3
"""Context patrol — estimates every active session's context fullness from its
transcript (bytes since last compaction boundary) and ntfy-pings Elliot when a
session runs hot. No Claude, stdlib only. Run 2x daily via launchd, or ad hoc.

Calibration: CAL_FULL_MB = since-boundary transcript MB that corresponds to a
~full (red-ring) context window. Tune by comparing a session's ring in the app
to this script's % for it, then adjust the env var in the launchd plist.
"""
import glob
import os
import re
import time
import urllib.request

B64RUN = re.compile(rb"[A-Za-z0-9+/=]{4096,}")

PROJECTS = os.path.expanduser("~/.claude/projects")
TOPIC = os.environ.get("MEADOWES_NTFY_TOPIC", "meadowes-elliot")
CAL_FULL_MB = float(os.environ.get("CAL_FULL_MB", "10"))
WARN_PCT = float(os.environ.get("WARN_PCT", "78"))
ACTIVE_DAYS = float(os.environ.get("ACTIVE_DAYS", "2"))
MARKER = b"compact_boundary"


def since_boundary_bytes(path):
    """Text bytes after the last compaction marker, discounting base64 image
    blobs (huge on disk, cheap in context — a pasted screenshot is ~2MB of
    transcript but ~1.5k tokens)."""
    size = os.path.getsize(path)
    last = -1
    with open(path, "rb") as f:
        chunk, overlap, pos = 1 << 20, len(MARKER) - 1, 0
        prev_tail = b""
        while True:
            buf = f.read(chunk)
            if not buf:
                break
            hay = prev_tail + buf
            i = hay.rfind(MARKER)
            if i != -1:
                last = pos - len(prev_tail) + i
            pos += len(buf)
            prev_tail = hay[-overlap:] if overlap else b""
    start = last if last >= 0 else 0
    text = 0
    with open(path, "rb") as f:
        f.seek(start)
        while True:
            buf = f.read(1 << 20)
            if not buf:
                break
            b64 = sum(len(m) for m in B64RUN.findall(buf))
            text += len(buf) - b64 + (b64 // 1300) * 60  # credit ~an image's real token weight
    return text


def main():
    now = time.time()
    hot, checked = [], 0
    for path in glob.glob(f"{PROJECTS}/*/*.jsonl"):
        try:
            if now - os.path.getmtime(path) > ACTIVE_DAYS * 86400:
                continue
            if os.path.getsize(path) < 200_000:  # skip tiny listener cycles
                continue
            checked += 1
            mb = since_boundary_bytes(path) / 1048576
            pct = 100 * mb / CAL_FULL_MB
            proj = os.path.basename(os.path.dirname(path)).replace("-Users-JERS", "") or "home"
            sess = os.path.basename(path)[:8]
            if pct >= WARN_PCT:
                hot.append(f"{proj.lstrip('-') or 'home'}/{sess} ~{pct:.0f}% ({mb:.1f}MB since compact)")
        except Exception:
            continue
    print(f"checked={checked} hot={len(hot)}")
    for h in hot:
        print(" ", h)
    if hot:
        body = "\n".join(hot) + "\nTell that session: 'write your handoff' — or just keep working; the tripwire hook will catch it."
        req = urllib.request.Request(
            f"https://ntfy.sh/{TOPIC}", data=body.encode(),
            headers={"Title": f"Context patrol: {len(hot)} session(s) running hot",
                     "Tags": "yellow_circle", "Priority": "default"}, method="POST")
        urllib.request.urlopen(req, timeout=10).read()


if __name__ == "__main__":
    main()
