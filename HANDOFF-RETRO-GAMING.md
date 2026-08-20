# Handoff — Retro Gaming on the Mac

**For:** a local Claude Code session with a shell on the Mac.
**Not** the media-stack handoff — that's `HANDOFF.md`, unrelated.

Written 20 August 2026 from a cloud session, which could not run anything on
the machine. Everything below marked "unverified" is unverified for that
reason.

---

## Goal

Play **Populous**, **SimCity**, **Creeper World** and **FTL** on this Mac,
without Steam. Full reasoning, version picks and purchase routes:
**`docs/RETRO-GAMING-M4.md`** — read it before acting, it explains *why* the
plan looks the way it does.

The one-line plan: one CrossOver bottle for the Windows titles, DOSBox-X and
Amiberry native for the DOS and Amiga classics.

---

## Machine facts (verified in-session)

| | |
|---|---|
| Machine | MacBook Air, Apple Silicon, user `JERS`, hostname `MacBook-Air` |
| Login shell | `bash` (macOS nags about zsh; harmless) |
| Boot volume | 512 GB, **~22 GB free** — tight, this drives the whole storage plan |
| External drive | `/Volumes/Sisu`, **APFS**, case-insensitive — correct for bottles |
| Repo checkout | `~/Thea-repo`, on branch `claude/retro-games-apple-silicon-m4-pf7ruw` |
| Open PR | Erstiv/Thea **#6** (draft). Push work there. |

### ⚠️ `~/Thea` is NOT the repo — do not touch it

There is a separate `~/Thea/scripts/meadowes/` holding a live Meadowes install
with **work that exists nowhere else**:

- `context-patrol.py`, `context-tripwire.py`, `handoff-pickup.py`,
  `meadowes-ctl.sh` — **never committed to any branch**
- `meadowes-listener-v2.sh` (6437 B local vs 5246 B in `main`) and
  `policy.md` (7158 B vs 5487 B) — **local edits ahead of `main`**

`scripts/meadowes/com.meadowes.listener.plist` hardcodes
`/Users/jers/Thea/scripts/meadowes/meadowes-listener.sh`, so a launchd job may
be pointing at that directory. **Unknown whether it is loaded** —
`launchctl list | grep -i meadowes` was never run to completion.

Do not clone into, move, or clear `~/Thea`. Rescuing that work onto a branch is
a **separate task**; see "Other open item" below.

---

## State

**Done:** research, the guide (`docs/RETRO-GAMING-M4.md`), the installer
(`scripts/retro/setup-mac-retro.sh`), PR #6.

**Runbook step 1 is complete — done on hardware 20 Aug 2026.** The toolchain is
installed and the script has been run, debugged and re-run clean:

- `dosbox-x` 2026.08.02 (formula), `amiberry` 8.3.0, `heroic` 2.22.1,
  `innoextract` 1.9 — all arm64, all working.
- Game tree created at `/Volumes/Sisu/Games`; Sisu confirmed APFS,
  case-insensitive, 1.8 TB free.
- DOSBox-X verified actually running DOS (it wrote a file to the host from
  inside the emulator).
- Three bugs found and fixed; see "What broke" below.

**Still not done:** CrossOver (step 2 onward). No game has been bought,
downloaded or launched.

### What broke, and what changed because of it

1. **`local dir="$1" probe="$dir"` → unbound variable.** Bash expands the whole
   line before `local` runs, so `$dir` is unset when `probe` is assigned; under
   `set -u` that is fatal. Split into separate `local` lines. This killed the
   script on its first-ever run.
2. **The `dosbox-x` cask is a trap.** `brew install --cask dosbox-x` installs
   `dosbox-x-app`, which is ad-hoc signed — macOS puts up *"Apple could not
   verify DOSBox-X … Move to Trash"* — and ships no `dosbox-x` on PATH, so every
   command line in the guide fails. The script now installs the **formula**,
   which is a signed arm64 bottle with the CLI. The broken cask was uninstalled.
3. **DOSBox-X hangs on first launch with no window and no error.** It opens a
   modal folder-selection panel at startup (`macosx_prompt_folder` →
   `[NSSavePanel runModal]`); from a terminal the panel never takes focus, so
   the process blocks in AppKit at 0% CPU forever. `sample <pid>` is what found
   it. Fix is `working directory option = noprompt` in the DOSBox-X preferences,
   which the script now sets. `-nopromptfolder` is the one-off equivalent.

Corrections to the previous handoff: **all four Homebrew names were right**,
including `amiberry`, which had been flagged as the likely wrong one. The
volume-check function reported `/Volumes/Sisu is APFS` correctly once bug 1 was
fixed.

### ⚠️ The boot volume is also named "Sisu"

`/Volumes/Sisu` is the external drive *right now*, and `/Volumes/Sisu 1` is a
symlink to `/`. That is a race: whichever volume mounts first takes the plain
name. With the external unmounted, `GAMES_DIR=/Volumes/Sisu/Games` would quietly
create directories on the 21 GB internal disk. The script now refuses to run
when `GAMES_DIR` is under `/Volumes` but resolves to the boot disk. Renaming one
of the two volumes would be the real fix — Elliot's call.

---

## Runbook

Work through these in order. Stop and report at the first failure.

### 1. Toolchain — ✅ DONE 20 Aug 2026

```bash
cd ~/Thea-repo && git pull
df -h /Volumes/Sisu
GAMES_DIR=/Volumes/Sisu/Games ./scripts/retro/setup-mac-retro.sh
```

Installs DOSBox-X, Amiberry, Heroic, innoextract via Homebrew; creates the game
tree on Sisu; prints next steps. Idempotent — safe to re-run.

Runs clean and is idempotent. Expected output ends with
`✓ DOSBox-X already set to noprompt` and `✓ created under /Volumes/Sisu/Games`.
The three bugs this shook out are described above.

### 2. CrossOver — installed, trial NOT started

`crossover` 26.3.0 is installed (notarized, CodeWeavers Developer ID) and the
script now reports `✓ CrossOver present`.

Bottles are already pointed at the external drive, so nothing large lands on the
19 GB boot disk:

```
~/Library/Application Support/CrossOver/Bottles -> /Volumes/Sisu/Games/crossover-bottles
```

**Elliot has to do the next bit** — launching CrossOver and starting the 14-day
trial needs an email address and a registration form, which is his to fill in,
not an agent's.

Create **one** bottle, Windows 10, named `Retro`, with **D3DMetal enabled**.
Every Windows game goes in it. Free alternative if the user prefers:
Sikarugir (`https://wineformac.org/`), more fiddling.

### 3. Prove the bottle with FTL — costs nothing

The user owns FTL on Steam. The Steam client would only fetch the macOS depot
(Intel, dies with Rosetta in macOS 28). SteamCMD can pull the **Windows** depot
with no client:

```bash
mkdir -p ~/steamcmd && cd ~/steamcmd
curl -sSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_osx.tar.gz | tar xz

./steamcmd.sh +@sSteamCmdForcePlatformType windows \
  +login <account> \
  +force_install_dir /Volumes/Sisu/Games/ftl \
  +app_update 212680 validate \
  +quit
```

**The user types their own credentials into the SteamCMD prompt.** Never ask
for a password or Steam Guard code, never put either in a command line.

App IDs — Creeper World 3 `280220` and Creeper World 4 `848480` are confirmed
from store URLs. FTL `212680` is from memory: **verify before relying on it.**

Then run the `.exe` from inside the bottle. If FTL launches, the architecture is
proven and everything after this is repetition.

### 4. Creeper World

Same SteamCMD route, or buy direct from `knucklecracker.com/common/buy.php`
(DRM-free, no launcher, and the money reaches the solo developer). CW4 and IXE
are Windows-only and always will be — bottle is the only path.

### 5. Populous and SimCity

These need GOG purchases (~$40 total), so they come last, after the bottle is
proven. Per-title steps are in the guide.

---

## Decisions already made — don't relitigate

- **Windows-in-a-bottle beats native Mac ports.** Rosetta 2 general support ends
  with macOS 28 (fall 2027), killing the old Intel Mac builds; CrossOver 27
  (early 2027) goes Apple-Silicon-native and drops Rosetta. The bottle outlives
  the ports.
- **Whisky is dead** (April 2025). CrossOver or Sikarugir.
- **Don't install Apple's Game Porting Toolkit directly** — developer tool, not
  a runtime. CrossOver/Sikarugir already bundle D3DMetal.
- **No clones.** The user offered to build lookalikes; the games are their
  content, not their mechanics. Reasoning is in the guide.
- **Bulk goes on Sisu, ~2 GB stays internal** (Homebrew wants `/opt/homebrew`,
  casks want `/Applications`). Not worth fighting for 2 GB.

---

## Rules of engagement

- **Push to `claude/retro-games-apple-silicon-m4-pf7ruw`** (PR #6), not `main`.
- **Never ask for Steam credentials.** Interactive prompt only.
- **Don't touch `~/Thea`.** See the warning above.
- Sisu must be **mounted before launching anything** — an absent volume turns a
  bottle into dangling symlinks.
- The user's weekly usage limit resets at 3:00 PM local; long unattended runs
  are the expensive part, not the conversation.
- The user dislikes Steam. Prefer GOG / direct-from-developer where a choice
  exists; SteamCMD is acceptable because it avoids the client entirely.

---

## Unverified / open

- CrossOver, the bottle, and every per-game step. Researched, not tested.
- No game bought, installed or launched.
- Whether a Meadowes launchd job is loaded on this machine.
- FTL's Steam app ID.
- Sizes in the guide are estimates, not measurements.
- Amiberry and Heroic are installed and notarized but have not been launched.

Resolved since the last handoff: the script now runs; all four Homebrew names
are correct; the volume check works.

## Other open item (separate task)

Rescue the uncommitted Meadowes work in `~/Thea/scripts/meadowes/` onto a
branch before it's lost. Four files exist nowhere but that directory. Do this
as its own change, not mixed into PR #6, and be careful — a daemon may be
running out of that path.

---

## Alternative to reading this

The originating cloud session holds the full reasoning as conversation. To pull
it into a terminal instead of starting fresh, from a checkout of this repo:

```bash
claude --teleport session_01HeaGpc4KTtMj3S9Q6cdFCy
```
