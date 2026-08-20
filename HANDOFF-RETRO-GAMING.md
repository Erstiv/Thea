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
(`scripts/retro/setup-mac-retro.sh`), PR #6 with three commits.

**Not done — everything real.** Nothing has been installed. No game has been
bought, downloaded, or launched. The script has only ever been syntax-checked.

---

## Runbook

Work through these in order. Stop and report at the first failure.

### 1. Toolchain

```bash
cd ~/Thea-repo && git pull
df -h /Volumes/Sisu
GAMES_DIR=/Volumes/Sisu/Games ./scripts/retro/setup-mac-retro.sh
```

Installs DOSBox-X, Amiberry, Heroic, innoextract via Homebrew; creates the game
tree on Sisu; prints next steps. Idempotent — safe to re-run.

**Expect breakage here.** The four Homebrew names came from search results, not
from `brew info`:

| Name used | Confidence |
|---|---|
| `--cask dosbox-x` | good — a formula `dosbox-x` also exists |
| `--cask heroic` | good |
| `--cask amiberry` | **weakest — most likely to be wrong** |
| `innoextract` (formula) | good; pulls `boost`, which is large |

If one fails, `brew search <name>` for the real name, fix the script, commit and
push to the PR branch. Don't paper over it locally — the script is a
deliverable.

The script also resolves `GAMES_DIR` to its volume and checks the filesystem.
On Sisu it should print `/Volumes/Sisu is APFS`. If it misreports, that check
is new code and unverified — fix it.

### 2. CrossOver

Not installed by the script (it's paid). Take the **14-day trial**:

```bash
brew install --cask crossover
```

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

- Nothing in `setup-mac-retro.sh` has ever run. The volume-check function is
  brand new.
- No game bought, installed or launched. Every per-game step in the guide is
  researched, not tested.
- Whether a Meadowes launchd job is loaded on this machine.
- FTL's Steam app ID.
- Sizes in the guide are estimates, not measurements.

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
