# Project Thea — Retro Gaming on Apple Silicon (M4)

Playing **Populous**, **SimCity**, **Creeper World** and **FTL** on an M4 Mac,
without Steam.

Researched August 2026. Prices are approximate and change constantly.

---

## TL;DR — the plan

| Game | Best version | Where to buy (no Steam) | How it runs on M4 |
|---|---|---|---|
| Populous | **Populous: The Beginning** (1998) + PopRe patches | GOG (DRM-free) | CrossOver bottle |
| Populous (classic) | **Populous II** (1991), DOS or Amiga | GOG (DRM-free) | DOSBox-X arm64 (native) / Amiberry (native) |
| SimCity | **SimCity 4 Deluxe** | Mac App Store *or* GOG | Native ARM *or* CrossOver bottle |
| Creeper World | **CW3: Arc Eternal** (peak) / **CW4** (most polished) | knucklecracker.com direct | CrossOver bottle |
| FTL | **Advanced Edition + Multiverse** | GOG (DRM-free) | CrossOver bottle |

**One decision drives all of it: build a single Windows-on-Mac bottle.**
Three of the four have no viable native path, and the native paths that do exist
are the ones with an expiry date (see Rosetta below).

Two happy exceptions stay fully native: **DOS** games (DOSBox-X has an arm64
build) and **Amiga** games (Amiberry 8.0 shipped ARM64 JIT in March 2026).

---

## The Rosetta clock — why "just use the Mac build" is the wrong instinct

This is the single most important fact for planning a retro library in 2026:

- macOS 26.4 (Feb 2026) already pops a warning every time you launch an
  Intel app: *this will stop working*.
- Rosetta 2 stays fully supported through **macOS 27 "Golden Gate"** (Sept 2026).
- **macOS 28 (fall 2027)** ends general Rosetta 2 support. Apple has said it will
  keep a narrow carve-out for "older, unmaintained game titles" that depend on
  Intel frameworks — but that is a promise with no published list, not a plan
  you should bet a library on.

So the old Intel Mac builds — FTL's Mac build, Creeper World 3's Mac build,
anything from the 2010s Mac gaming era — are on a ~1 year fuse.

Meanwhile the *translation layer* route is moving the opposite direction:
CodeWeavers has an Apple-Silicon-native CrossOver build in testing as of
July 2026, and **CrossOver 27 (early 2027) drops Intel entirely and runs without
Rosetta**. A Windows game in a CrossOver bottle is, counterintuitively, the more
future-proof option than the game's own Mac port.

---

## Step 0 — build the toolchain once

Run `scripts/retro/setup-mac-retro.sh`, or do it by hand:

```bash
# Homebrew first (if not already present)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install --cask crossover     # ~$74 one-time, 14-day trial. The paid pick.
brew install --cask heroic        # native ARM launcher for GOG + Epic, no Steam
brew install --cask dosbox-x      # native arm64 DOS emulator
brew install --cask amiberry      # native ARM64 Amiga emulator (JIT since v8.0)
brew install innoextract          # unpack GOG Windows installers without Windows
```

**Free alternative to CrossOver:** Sikarugir (the Kegworks fork of Wineskin,
renamed Oct 2025). It exposes D3DMetal / DXVK / DXMT backends directly and is
actively maintained. It is the current recommended free option — but you will
spend evenings fiddling that CrossOver would have spent for you. For four games,
CrossOver's price is worth it.

**Do not install Apple's Game Porting Toolkit directly.** It is a developer
evaluation tool, not an end-user runtime. CrossOver and Sikarugir already
bundle the useful part (D3DMetal).

### The bottle

Make **one** CrossOver bottle, Windows 10, call it `Retro`. Enable D3DMetal in
the bottle settings. Every Windows game below goes in it. One bottle to maintain,
one set of shared runtimes, one thing to back up.

---

## Populous

### Which version is actually best

The series splits into two different games:

**The classics (1989 / 1991).** Populous I is the historically important one but
it is thin by modern standards — the god-powers are few and the AI is simple.
**Populous II: Trials of the Olympian Gods** is the one to play: far deeper
power set, a real campaign, and it holds up. The **Amiga version is the
definitive one** (better palette, much better music); the DOS version is very
close and dramatically easier to set up.

**Populous: The Beginning (1998).** A completely different game — full 3D RTS,
shaman, spell research, world-conquest campaign. It is also the only one with a
*living* community: **Populous Reincarnated (popre.net)** still runs a
matchmaker, maintains the Collective Populous Patch 1.03, and ships an
**Enhanced Edition** mod that fixes high-resolution support (the vanilla engine
falls apart much above 1600×900).

**My pick:** Populous: The Beginning, patched, if you want something to keep
playing. Populous II in DOSBox-X if you want the thing you remember.

### Where to buy without Steam

All three are on **GOG, DRM-free** — Populous, Populous II, and Populous: The
Beginning (with the *Undiscovered Worlds* expansion). They are also on Epic
(added March 2024) and the EA app. GOG is the right choice: offline installers,
no launcher required, nothing phoning home. Roughly $6 each, frequently $1–2 on
sale.

### Running them

**Populous / Populous II (GOG = DOS builds):**
GOG wraps these in DOSBox — a *Windows* DOSBox, which is useless to you. Skip it:

```bash
# from the GOG offline installer .exe
innoextract setup_populous_*.exe -d ~/Games/populous2
dosbox-x -c "mount c ~/Games/populous2/app" -c "c:" -c "POPULOUS.EXE"
```

Native arm64, no Rosetta, no translation layer, will still work in 2030.

**Populous II on Amiga (the better version):**
Amiberry via Homebrew, plus Kickstart ROMs. Buy those legitimately in
*Amiga Forever* (~$10) rather than scraping ROM sites — it is cheap and it is
the only clean way to get them. Configure an A1200 or A500+ with 2MB chip RAM.

**Populous: The Beginning:**
Install the GOG version into the `Retro` bottle. Then, from popre.net: patch
1.03, then the Enhanced Edition mod for resolution. Run in Direct3D mode; if it
glitches, software mode is period-accurate anyway. If you want multiplayer, the
PopRe matchmaker is the entire scene and it works fine under Wine.

---

## SimCity

### Which version

- **SimCity Classic (1989)** — EA open-sourced it under GPLv3 as **Micropolis**.
  Free and legal forever. `micropolisweb.com` runs it in a browser; there is a
  buildable source tree at github.com/SimHacker/micropolis. Charming, but it's a
  museum piece.
- **SimCity 2000 (1993)** — the sentimental favourite for most people.
  Awkwardly, it is *not* on GOG. Your options are the DOS version in DOSBox-X
  (from your own discs, or the SC2000 Special Edition that EA gives away free in
  the EA app — which means installing yet another launcher).
- **SimCity 3000 Unlimited (1999)** — on **GOG, DRM-free**. Good, underrated,
  and the cheapest clean path to a "real" SimCity.
- **SimCity 4 Deluxe (2003)** — still the enthusiast standard, twenty-three years
  on, because of the mod ecosystem (the Network Addon Mod alone is a decade of
  community work). **This is the one to get.**

### Two paths for SimCity 4, pick by how much you want to mod

**Path A — Mac App Store (zero effort).** Aspyr's SimCity 4 Deluxe went
Apple-Silicon-native in January 2023 and is sold on the Mac App Store, no Steam
involved. It just runs. The catch: it is a fork that lags the Windows build,
and the mod ecosystem assumes Windows paths — installing NAM and friends ranges
from fiddly to not-worth-it.

**Path B — GOG + CrossOver (the real thing).** SimCity 4 Deluxe is on GOG
DRM-free. Install it into the `Retro` bottle and you get the entire Windows mod
stack exactly as documented everywhere online. SC4 is a 2003 single-threaded
Direct3D game; it is not going to trouble an M4.

Useful SC4 launch flags either way (it defaults badly on modern hardware):

```
-CPUcount:1 -CPUpriority:high -d:software -w -r1920x1080
```

Drop `-d:software` first and only add it back if you get graphical corruption.

**My pick:** Path A if you want to play SimCity this evening. Path B if you
know you're going to end up installing NAM at 2am, which, if you're asking about
SimCity in 2026, you are.

---

## Creeper World

### The honest situation

This is the awkward one. Knuckle Cracker (one developer, Virgil) has said
plainly that Mac is a moving target — CPU architecture, graphics API, code
signing, all churning — and that the maths doesn't work for a solo dev.
Result:

- **Creeper World 4 (2020): Windows only.** No Mac build.
- **Creeper World IXE (2023): Windows only.** No Mac build.
- **Creeper World 3 (2014):** an old Mac build exists but it is from the
  32-bit era and has been unreliable since Catalina.
- **Creeper World 1 / 2:** ancient, Flash/AIR-era. Historical interest.

So there is no native path here and there isn't going to be one. CrossOver is
not a workaround; it's the answer.

### Which version

**CW3: Arc Eternal** is the series peak for most people — the campaign, the map
editor, and thousands of community maps that still get played. **CW4** is the
most polished and moves to 3D terrain; some purists think the 3D costs it
readability. **IXE** is the newest and the most experimental.

If you're returning to the series: CW3. If you want the best-looking one: CW4.

### Buying without Steam

Knuckle Cracker sells **all of them directly** at
`knucklecracker.com/common/buy.php` — CW1, CW2, CW3, CW4, Particle Fleet, and
soundtracks. Plain downloads, no launcher, no DRM, and there's a
`redownload.php` page that recovers your downloads by email. This is a
developer selling you a zip file. It is exactly what you want.

You already own these on Steam, so see "Getting Steam-purchased games out of
Steam" below before you rebuy anything.

### Running it

Install the Windows build into the `Retro` bottle. CW4 is a Unity/DirectX 11
game — squarely in D3DMetal's comfort zone, and it's a 2D-simulation-heavy
title, not a GPU hog. Users have been running CW4 under CrossOver since the
Monterey days on far weaker hardware than an M4.

---

## FTL: Faster Than Light

### Which version

**FTL: Advanced Edition** is the definitive base game — it was a free update, so
every current copy is AE. But if you've played out vanilla, the real answer is
**FTL: Multiverse**: a total-conversion overhaul with 200+ ships, new factions,
and more written content than the base game. It is, by a distance, the most
game-per-hour version of FTL that exists.

Multiverse requires **Hyperspace**, the mod platform that hard-patches the
executable. Hyperspace is **Windows-only**. That single fact decides your setup.

### Buying without Steam

**GOG**, DRM-free, offline installers, all three platforms. Around $10.

### Running it

**Vanilla, quickest:** GOG's Mac build works. It's a 64-bit Intel app, so it
runs under Rosetta 2 today — and stops working with macOS 28 in about a year.

**Multiverse, and the future-proof option:** install the **Windows** GOG build
into the `Retro` bottle, then run the Hyperspace installer inside the bottle,
then drop Multiverse in via Slipstream Mod Manager (Java, runs natively — you
can even patch the files from macOS and just point it at the bottle's game
folder).

**My advice: skip the Mac build entirely.** Install the Windows version in the
bottle from day one. Same bottle as everything else, mods work, and it outlives
Rosetta. There is no upside to the Mac build except five minutes saved.

---

## Getting Steam-purchased games out of Steam

You already own FTL and Creeper World on Steam. Both are DRM-free builds — the
Steam client is a download mechanism for them, not a runtime requirement. You do
not have to rebuy them, and you do not have to keep Steam installed.

**SteamCMD, once, from the terminal** — no client, no store, no overlay. It can
pull the *Windows* depots onto your Mac, which is what you want for the bottle:

```bash
# SteamCMD is an Intel binary — fine under Rosetta today, and you only need it once
mkdir -p ~/steamcmd && cd ~/steamcmd
curl -sSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_osx.tar.gz | tar xz

./steamcmd.sh +@sSteamCmdForcePlatformType windows \
  +login <your-account> \
  +force_install_dir ~/Games/ftl \
  +app_update 212680 validate \
  +quit
```

App IDs: FTL 212680, Creeper World 3 280220, Creeper World 4 848480.
Copy the resulting folder into the bottle's drive and run the `.exe` directly.
Steam never launches again.

Caveats, stated plainly: this needs your Steam credentials once (SteamCMD is
Valve's own tool, so this is a supported path, not a hack); and it is worth
buying Creeper World direct from Knuckle Cracker anyway, because that money goes
to one person who is still making these games.

---

## Should we just build clones instead?

You offered. My answer is no, with one exception.

The reason isn't difficulty — a Creeper-World-like fluid simulation or an
FTL-like ship-management roguelike are both genuinely tractable projects. The
reason is that **none of these games are their mechanics**. FTL is 100,000 words
of event writing and twenty years of balance. Creeper World 4 is 200 hand-built
missions plus a community map ecosystem. SimCity 4 is the Network Addon Mod.
Populous: The Beginning is the people still on the PopRe matchmaker. A clone
gives you the engine and none of the reason to play.

The four games above all run today, legally, for about $50 total, on hardware
you already own. Building even one credible clone would cost more effort than
the entire library and leave you with a worse version.

**The exception, and the thing actually worth building:** the setup itself is
fiddly, undocumented across four different toolchains, and will need
re-doing when CrossOver 27 lands and Rosetta dies. That's a script, not a game.
See `scripts/retro/setup-mac-retro.sh`.

---

## Rough costs

| Item | Cost |
|---|---|
| CrossOver (one-time, or free 14-day trial) | ~$74 |
| Sikarugir (free alternative) | $0 |
| GOG: Populous + Populous II | ~$12 |
| GOG: Populous: The Beginning | ~$6 |
| GOG: SimCity 4 Deluxe | ~$20 |
| Mac App Store: SimCity 4 Deluxe (alternative) | ~$20 |
| GOG: FTL Advanced Edition | ~$10 |
| Knuckle Cracker: CW3 / CW4 (already owned on Steam) | ~$15 / ~$25 |
| Amiga Forever (Kickstart ROMs, only if doing Amiga) | ~$10 |
| DOSBox-X, Amiberry, Heroic, innoextract, Micropolis | $0 |

Everything except CrossOver goes on sale regularly; the GOG classics hit $1–2.

---

---

---

## Putting it on an external drive

An internal drive with under ~30 GB free is not enough headroom for this plus
macOS. The good news is that almost all the bulk moves off cleanly.

### What moves

| | Where |
|---|---|
| Game data | `GAMES_DIR=/Volumes/YourDrive/Games ./scripts/retro/setup-mac-retro.sh` |
| CrossOver bottles | point the bottle directory at the drive, or symlink `~/Library/Application Support/CrossOver/Bottles` |
| Heroic downloads | configurable default install path in its settings |
| DOS / Amiga data | anywhere — `dosbox-x -c "mount c /Volumes/YourDrive/Games/populous2"` |

The bottle plus SimCity 4 plus Multiverse is most of the total, so relocating
those three covers the problem.

### What stays internal (~2 GB)

Homebrew on Apple Silicon expects `/opt/homebrew`, and casks install `.app`
bundles into `/Applications`. Both can be fought; neither is worth it for a
couple of gigabytes. CrossOver itself likewise. Budget ~1 GB for the toolchain
and ~1 GB for the CrossOver app, on the boot volume.

### Format the drive correctly

**APFS or HFS+ — never exFAT, FAT32 or NTFS.** Wine bottles need POSIX
permissions and symlinks; those filesystems have neither, and bottles fail in
confusing ways rather than cleanly. `setup-mac-retro.sh` checks this and warns,
but check yourself before you commit to a drive:

```bash
diskutil info /Volumes/YourDrive | grep -i "file system"
```

- Use **plain APFS, not APFS (Case-sensitive)** — old Windows installers assume
  case-insensitive paths.
- The volume must be **mounted before launching anything**. A missing drive
  turns a bottle into dangling symlinks.
- USB3 SSD is fine. A spinning USB drive plays but loads slowly on the bigger
  titles. Thunderbolt/USB4 NVMe on an M4 is effectively internal speed.

### Rough sizes

| | |
|---|---|
| Toolchain (DOSBox-X, Amiberry, Heroic, innoextract) | ~0.5-1 GB |
| CrossOver app + one Windows 10 bottle | ~2 GB |
| Populous 1 & 2 (DOS) | a few MB |
| Populous: The Beginning | ~500 MB |
| SimCity 3000 | ~500 MB |
| SimCity 4 Deluxe | ~2 GB, **but NAM and mods can pass 10 GB** |
| Creeper World 3 / 4 | ~200 MB / ~1 GB |
| FTL, or FTL + Multiverse | ~300 MB / ~1-2 GB |

Everything except SimCity 4 modding is bounded. Total lands around 8-10 GB.


## Session handoff

Written 20 August 2026 in a cloud session on branch
`claude/retro-games-apple-silicon-m4-pf7ruw` (PR #6).

**To pick this up again**, open the session "Playing Populous, SimCity, Creeper
World, FTL on M4" from the Code tab or claude.ai/code, or pull the whole
conversation into a terminal from a checkout of this repo:

```bash
claude --teleport session_01HeaGpc4KTtMj3S9Q6cdFCy
```

### Settled

- The layered plan: one Windows bottle for Populous: The Beginning, SimCity 4,
  Creeper World and FTL; DOSBox-X and Amiberry stay native for the DOS and
  Amiga classics.
- Every non-Steam purchase route above was verified against the stores'
  own listings in August 2026.

### Not verified — do this first

- **Nothing in `scripts/retro/setup-mac-retro.sh` has run on real hardware.**
  It was authored in a Linux container; only `bash -n` and the macOS/arch
  guards were exercised. The Homebrew cask names (`dosbox-x`, `amiberry`,
  `heroic`, `crossover`) came from search results, not from
  `brew info`. Expect at least one to need correcting on first run.
- No game has actually been installed or launched. The per-game steps are
  researched, not tested.

### Open threads

- **CrossOver 27, early 2027** — goes Apple-Silicon-native and drops Rosetta.
  If you are reading this near that date, re-check before buying a licence;
  upgrade terms may matter.
- **macOS 28, fall 2027** — general Rosetta 2 support ends. Anything still
  depending on an Intel Mac build needs to have moved into the bottle by then.
  Apple's carve-out for "older, unmaintained games" has no published list, so
  do not assume a specific title is covered.
- Prices in the cost table drift constantly; the GOG classics hit $1-2 on sale.

## Sources

- [macOS Tahoe 26.4 Rosetta 2 warnings — MacRumors](https://www.macrumors.com/2026/02/16/macos-tahoe-26-4-rosetta-2-warnings/)
- [Preparing for next year's Rosetta 2 demise — Six Colors](https://sixcolors.com/post/2026/08/preparing-for-next-years-rosetta-2-demise/)
- [First Apple Silicon native CrossOver build in testing — AppleInsider](https://appleinsider.com/articles/26/07/31/first-apple-silicon-native-crossover-build-in-testing-as-rosettas-end-nears)
- [What's in and what's out for CrossOver 27 — CodeWeavers](https://www.codeweavers.com/blog/mjohnson/2026/6/11/whats-in-and-whats-out-for-crossover-27)
- [Whisky is dead — what replaces it in 2026 — Pixel Port](https://pixelport.gg/blog/whisky-is-dead-what-replaces-it/)
- [Whisky development ends on macOS — AppleInsider](https://appleinsider.com/articles/25/04/16/whisky-development-ends-on-macos-to-help-wine-flourish)
- [WINE for Mac — CrossOver / Sikarugir / GPTK overview](https://wineformac.org/)
- [DOSBox-X releases (macOS arm64 builds)](https://github.com/joncampbell123/dosbox-x/releases)
- [DOSBox Staging — macOS](https://www.dosbox-staging.org/releases/macos/)
- [Amiberry](https://amiberry.com/) · [Amiberry v8.0.0 release notes](https://www.emucr.com/2026/03/amiberry-v800.html)
- [Heroic Games Launcher on macOS — wiki](https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher/wiki/Using-Heroic-on-a-Mac-computer)
- [Populous: The Beginning on GOG](https://www.gog.com/en/game/populous_the_beginning)
- [Populous 2 on the Epic Games Store](https://store.epicgames.com/en-US/p/populous-2-trials-of-the-olympian-gods-6d4f52)
- [Populous: Reincarnated (PopRe)](https://www.popre.net/) · [downloads](https://www.popre.net/downloads.php?f=10)
- [Populous: The Beginning — PCGamingWiki](https://www.pcgamingwiki.com/wiki/Populous:_The_Beginning)
- [SimCity 4 Deluxe on the Mac App Store](https://apps.apple.com/us/app/simcity-4-deluxe-edition/id804079949?mt=12)
- [Aspyr — Apple Silicon compatibility updates](https://support.aspyr.com/hc/en-us/articles/5715420742541-Apple-Silicon-Compatibility-Updates)
- [SimCity 4 — AppleGamingWiki](https://www.applegamingwiki.com/wiki/SimCity_4)
- [SimCity 3000 Unlimited on GOG](https://www.gog.com/en/game/simcity_3000)
- [Micropolis (open-source SimCity)](https://github.com/SimHacker/micropolis)
- [Knuckle Cracker — purchase page](https://knucklecracker.com/common/buy.php) · [CW3 redownload](http://knucklecracker.com/creeperworld3/redownload.php)
- [Creeper World 4 — CrossOver compatibility](https://www.codeweavers.com/compatibility/crossover/creeper-world-4)
- [Creeper World 4 — PCGamingWiki](https://www.pcgamingwiki.com/wiki/Creeper_World_4)
- [FTL: Faster Than Light — AppleGamingWiki](https://www.applegamingwiki.com/wiki/FTL:_Faster_Than_Light)
- [FTL Hyperspace — Mac install guide](https://ftl-hyperspace.github.io/FTL-Hyperspace/install-guides/mac/)
- [FTL: Multiverse — installation](https://ftlmultiverse.miraheze.org/wiki/Installing_Multiverse)
- [FTL: Advanced Edition — GOG support](https://support.gog.com/hc/en-us/articles/213519309-FTL-Advanced-Edition)
