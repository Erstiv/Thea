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
| External drive | `/Volumes/SisuGames`, **APFS**, case-insensitive — correct for bottles |
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
- Game tree created at `/Volumes/SisuGames/Games`; Sisu confirmed APFS,
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

### The "Sisu" name collision — happened, then fixed

The boot volume (`disk3s1`, the macOS system volume) was **also** named `Sisu`,
so two mounted volumes wanted `/Volumes/Sisu` and macOS handed the loser
`/Volumes/Sisu 1`. That is a race, and it flipped mid-session on 2026-08-20:
the external held `/Volumes/Sisu` at 11:38 and had lost it by 12:18, at which
point `/Volumes/Sisu` was a symlink to `/` and anything written through that
path went to the 21 GB boot disk. It caught the CrossOver bottles symlink,
which silently started resolving to a nonexistent `/Games`.

**Resolved:** Elliot renamed the external to `SisuGames`
(`diskutil rename /dev/disk7s1 SisuGames`), which remounted immediately at
`/Volumes/SisuGames`. The boot volume keeps the name `Sisu`, and
`/Volumes/Sisu` is now just its symlink to `/` with nothing contending for it.

**Everything is `/Volumes/SisuGames/Games` from here on.** The guard in the
script stays — it is what would have caught this before a 2 GB bottle landed on
the boot disk.

---

## Runbook

Work through these in order. Stop and report at the first failure.

### 1. Toolchain — ✅ DONE 20 Aug 2026

```bash
cd ~/Thea-repo && git pull
df -h /Volumes/SisuGames
GAMES_DIR=/Volumes/SisuGames/Games ./scripts/retro/setup-mac-retro.sh
```

Installs DOSBox-X, Amiberry, Heroic, innoextract via Homebrew; creates the game
tree on Sisu; prints next steps. Idempotent — safe to re-run.

Runs clean and is idempotent. Expected output ends with
`✓ DOSBox-X already set to noprompt` and `✓ created under /Volumes/SisuGames/Games`.
The three bugs this shook out are described above.

### 2. CrossOver — installed, trial NOT started

`crossover` 26.3.0 is installed (notarized, CodeWeavers Developer ID) and the
script now reports `✓ CrossOver present`.

Bottles are already pointed at the external drive, so nothing large lands on the
19 GB boot disk:

```
~/Library/Application Support/CrossOver/Bottles -> /Volumes/SisuGames/Games/crossover-bottles
```

**Elliot has to do the next bit** — launching CrossOver and starting the 14-day
trial needs an email address and a registration form, which is his to fill in,
not an agent's.

Create **one** bottle, Windows 10, named `Retro`, with **D3DMetal enabled**.
Every Windows game goes in it. Free alternative if the user prefers:
Sikarugir (`https://wineformac.org/`), more fiddling.

### 3. Prove the bottle with FTL — ✅ DONE 20 Aug 2026, it runs

The user owns FTL on Steam. The Steam client would only fetch the macOS depot
(Intel, dies with Rosetta in macOS 28). SteamCMD can pull the **Windows** depot
with no client:

```bash
mkdir -p ~/steamcmd && cd ~/steamcmd
curl -sSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_osx.tar.gz | tar xz

./steamcmd.sh +@sSteamCmdForcePlatformType windows \
  +login <account> \
  +force_install_dir /Volumes/SisuGames/Games/ftl \
  +app_update 212680 validate \
  +quit
```

**The user types their own credentials into the SteamCMD prompt.** Never ask
for a password or Steam Guard code, never put either in a command line.

App IDs — all three verified against Steam's appdetails API 20 Aug 2026:
FTL `212680`, Creeper World 3 `280220`, Creeper World 4 `848480`.

⚠️ **The Steam account holds FTL and nothing else.** Creeper World is NOT on it
— the previous handoff and the guide both assumed otherwise. CW has to be
bought; knucklecracker.com direct is the right route.

Launching it, once downloaded:

```bash
/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/cxstart \
  --bottle SisuGames --wait-children -- "/Volumes/SisuGames/Games/ftl/FTLGame.exe"
```

Health check when you cannot see the window: a working game holds double-digit
CPU; a stalled Wine or emulator process sits at 0.0%.

Then run the `.exe` from inside the bottle. If FTL launches, the architecture is
proven and everything after this is repetition.

### 3b. Launchers — ✅ built, FTL tested

`scripts/retro/make-launcher.sh` builds a double-clickable `.app` in
`~/Applications` for either a bottle game or a DOS game:

```bash
./scripts/retro/make-launcher.sh bottle "FTL" "/Volumes/SisuGames/Games/ftl/FTLGame.exe"
./scripts/retro/make-launcher.sh dosbox "Populous II" "/Volumes/SisuGames/Games/populous2/app" POPULOUS.EXE
```

It checks the games drive is mounted and says so in a dialog rather than failing
silently, and it lifts the game's own icon out of the Windows `.exe` via
`icoutils` (added to the toolchain). `FTL.app` is built and verified — launches
to ~90% CPU, and the missing-target path exits 1 with a visible alert.

**Two traps worth remembering if you touch that generator:**

- An applet's `do shell script "... &"` child is killed when the applet quits.
  The game must be started with `nohup` from a script inside the bundle, not
  from the AppleScript.
- Do not embed paths in AppleScript string literals. A path with a space comes
  back from `printf %q` as `My\ Drive`, and `\ ` is a syntax error in
  AppleScript, not a space. The generated `launch.sh` holds the real command;
  the applet just calls it.

### 4. Creeper World — he already owns CW1, direct from the developer

Not on Steam — that account has FTL and nothing else. Creeper World 1 was bought
**direct from Knuckle Cracker on 3 Feb 2010**.
Still installed at `/Applications/KnuckleCracker/Creeper World.app`, an Adobe
AIR app, `ppc i386` — dead on Apple Silicon, unrunnable, keep it only as
evidence. Save data from 2014 survives in
`~/Library/Preferences/CreeperWorld/` (`gameData.dat`, `keyData.dat`).

**Recovered and installed 20 Aug 2026.** `redownload.php` served
`CreeperWorldInstall.exe` (22.7 MB, Inno Setup) which installs silently:

```bash
cxstart --bottle SisuGames -- CreeperWorldInstall.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
```

What it installs is **Creeper World Anniversary Edition** (2016 build) — the
modern rebuild, not the 2010 original. ⚠️ It is still an **Adobe AIR** app with
a captive runtime (`Adobe AIR/Versions/1.0/Adobe AIR.dll`, AIR 23.0.0.257), and
AIR under Wine is the hard case, not the easy one.

**Status: ✅ CONFIRMED WORKING 20 Aug 2026** — window renders, audio plays.
The low CPU reading below was a title screen idling, not a failure; recorded
because it is exactly the reading a dead launch gives, and the two are not
distinguishable without looking.

**Original ambiguous reading:** The process stays alive and the AIR
runtime initialises — it writes `AppData/Roaming/CreeperWorld/#airversion` and,
once launched with the correct working directory, `Local Store`. But
instantaneous CPU sits at 0.0-0.5%, where FTL runs at ~90%. For a 2D Flash-era
game idling on a title screen that is not damning, but it is not proof either.
**Needs a human to look at the screen** — Wine's own windows are invisible to
macOS screenshot APIs under native filtering.

Not needed in the end, but if an AIR title ever does come up blank: install the
system Adobe AIR runtime into the bottle rather than relying on the captive one,
and try CrossOver's "Install unlisted application" flow, which configures
overrides a bare `cxstart` does not.

**Lesson for the CPU heuristic:** ~0% CPU proves a process is not *rendering
continuously*; it does not prove failure. A 2D or Flash-era game parked on a
menu is legitimately idle. High CPU is positive evidence; low CPU is only a
prompt to go and look.

⚠️ **Debugging Wine under CrossOver: `WINEDEBUG` from the calling environment is
ignored** — cxstart appends its own `WINEDEBUG=-all` to the process, so
`WINEDEBUG=+err cxstart ...` silently produces nothing. That cost time.

The 2010 FastSpring download links in the receipt are **dead** — they now return
an 8 KB store page, as the email warned they would after two weeks. But
`knucklecracker.com/creeperworld/redownload.php` is live (HTTP 200), and the
receipt carries the licence key. Recover the Windows build there and put it in
the bottle; only CW3/CW4 would need buying.

⚠️ The licence key is in Elliot's Gmail, not in this repo, and must stay that
way — this branch is public.



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
