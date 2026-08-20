#!/bin/bash
# Project Thea — retro gaming toolchain for Apple Silicon (M4)
# Installs everything needed to play Populous, SimCity, Creeper World and FTL
# on a Mac without Steam. See docs/RETRO-GAMING-M4.md for the why.
#
# Safe to re-run: everything is checked before it is installed.

set -uo pipefail

CROSSOVER_BOTTLE="${CROSSOVER_BOTTLE:-Retro}"
GAMES_DIR="${GAMES_DIR:-$HOME/Games}"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }

say "=== Project Thea — Retro Gaming Setup (Apple Silicon) ==="

# --- sanity ------------------------------------------------------------------

if [ "$(uname -s)" != "Darwin" ]; then
    echo "This script is for macOS only." >&2
    exit 1
fi

ARCH="$(uname -m)"
if [ "$ARCH" != "arm64" ]; then
    warn "Detected $ARCH, not arm64. This script targets Apple Silicon."
    info "It will still work, but the native-ARM advice below won't apply."
fi

say "macOS version"
SW_VERS="$(sw_vers -productVersion)"
ok "macOS $SW_VERS"
case "$SW_VERS" in
    2[89].*|3[0-9].*)
        warn "Rosetta 2 general support ended in macOS 28."
        info "Intel-only game builds (old Mac ports) will not launch."
        info "Use the CrossOver bottle for everything — see the guide."
        ;;
esac

# --- games volume ------------------------------------------------------------

# GAMES_DIR often points at an external drive. Wine bottles and app bundles need
# POSIX permissions and symlinks, so exFAT/FAT/NTFS will fail in confusing ways.
check_games_volume() {
    local dir="$1"
    local probe="$dir"
    local mount fs

    command -v diskutil >/dev/null 2>&1 || return 0

    # walk up to the nearest ancestor that exists yet
    while [ ! -d "$probe" ] && [ "$probe" != "/" ]; do
        probe="$(dirname "$probe")"
    done

    mount="$(df -P "$probe" 2>/dev/null | awk 'NR==2 {for (i=6; i<=NF; i++) printf "%s%s", $i, (i<NF ? " " : "")}')"
    [ -n "$mount" ] || return 0

    # A GAMES_DIR under /Volumes that lands on the boot volume means the
    # external drive is not mounted — macOS will happily create the directory
    # on the internal disk instead, and you find out when it fills up. This
    # also bites when the boot volume shares a name with the external one:
    # whichever mounts first takes /Volumes/<name>, the other gets "<name> 1".
    case "$dir" in
        /Volumes/*)
            # "/" and "/System/Volumes/Data" are both the boot disk; an absent
            # external drive walks up to /Volumes and reports the latter.
            if [ "$mount" = "/" ] || [ "$mount" = "/System/Volumes/Data" ]; then
                warn "$dir is on the BOOT volume, not an external drive."
                info "The drive is not mounted. Mount it and re-run — otherwise"
                info "games install to the internal disk and fill it."
                info "Watch for a boot volume with the same name as the external:"
                info "whichever mounts first wins /Volumes/<name>, the other"
                info "becomes \"/Volumes/<name> 1\"."
                return 1
            fi
            ;;
    esac

    fs="$(diskutil info "$mount" 2>/dev/null \
          | awk -F: '/File System Personality/ {sub(/^[ \t]+/, "", $2); print $2}')"
    [ -n "$fs" ] || return 0

    case "$fs" in
        *ExFAT*|*exFAT*|*FAT32*|*MS-DOS*|*NTFS*)
            warn "$mount is $fs — games will not run reliably from it."
            info "Wine bottles need POSIX permissions and symlinks; exFAT/FAT/NTFS"
            info "have neither. Reformat as APFS, or pick a different volume."
            ;;
        *Case-sensitive*)
            warn "$mount is $fs."
            info "Some old Windows installers assume case-insensitive paths and"
            info "will fail here. Plain APFS is the safer choice."
            ;;
        *)
            ok "$mount is $fs"
            ;;
    esac
}

say "Games volume"
if ! check_games_volume "$GAMES_DIR"; then
    echo "Refusing to continue — fix GAMES_DIR and re-run." >&2
    exit 1
fi
info "games dir: $GAMES_DIR"
info "override with: GAMES_DIR=/Volumes/YourDrive/Games $0"

# --- homebrew ----------------------------------------------------------------

say "Homebrew"
if ! command -v brew >/dev/null 2>&1; then
    warn "Homebrew not found. Installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
        echo "Homebrew install failed. Install it manually and re-run." >&2
        exit 1
    }
    # Apple Silicon default prefix
    [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
else
    ok "Homebrew present ($(brew --version | head -1))"
fi

install_formula() {
    local name="$1" why="$2"
    if brew list --formula "$name" >/dev/null 2>&1; then
        ok "$name already installed"
    else
        info "installing $name — $why"
        brew install "$name" >/dev/null 2>&1 && ok "$name installed" \
            || warn "$name failed to install (skipping)"
    fi
}

install_cask() {
    local name="$1" why="$2"
    if brew list --cask "$name" >/dev/null 2>&1; then
        ok "$name already installed"
    else
        info "installing $name — $why"
        brew install --cask "$name" >/dev/null 2>&1 && ok "$name installed" \
            || warn "$name failed to install (check: brew info --cask $name)"
    fi
}

# --- emulators & tools -------------------------------------------------------

say "Native emulators (no Rosetta, no translation layer)"
# DOSBox-X comes from the FORMULA, not the cask. The cask (dosbox-x-app) is
# ad-hoc signed, so Gatekeeper shows a "could not verify ... Move to Trash"
# dialog, and it ships no `dosbox-x` on PATH. The formula is a signed arm64
# bottle with the CLI the rest of this guide assumes. Verified 2026-08-20.
install_formula dosbox-x   "DOS games — Populous 1/2, SimCity 2000. Native arm64."
install_cask    amiberry   "Amiga — the definitive Populous II. ARM64 JIT since v8.0."

say "Launchers and unpacking tools"
install_cask    heroic     "native ARM launcher for GOG + Epic libraries, no Steam"
install_formula innoextract "unpack GOG Windows installers without needing Windows"

say "Windows compatibility layer"
if [ -d "/Applications/CrossOver.app" ]; then
    ok "CrossOver present"
else
    warn "CrossOver not installed."
    info "It is the recommended (paid, ~\$74, 14-day trial) option:"
    info "    brew install --cask crossover"
    info "Free alternative — Sikarugir (the maintained Kegworks/Wineskin fork):"
    info "    https://wineformac.org/"
    info "CrossOver 27 (early 2027) goes Apple-Silicon-native and drops Rosetta,"
    info "which is why the bottle route outlives the old Intel Mac ports."
fi

# --- dosbox-x working directory ----------------------------------------------

# Out of the box DOSBox-X opens a modal folder-selection panel at startup
# (macosx_prompt_folder -> [NSSavePanel runModal]). Launched from a terminal the
# panel never gets focus, so DOSBox-X hangs at 0% CPU with no window and no
# error — it looks like a broken install. Setting the working directory option
# to "noprompt" makes it start straight into DOS. Verified 2026-08-20.
configure_dosbox_x() {
    local conf
    command -v dosbox-x >/dev/null 2>&1 || { warn "dosbox-x not on PATH — skipping"; return 0; }

    # generate the user config if this is a first run; -nopromptfolder keeps
    # that generating run from hanging on the very panel we are disabling
    conf="$(ls -t "$HOME/Library/Preferences/DOSBox-X"*"Preferences" 2>/dev/null | head -1)"
    if [ -z "$conf" ]; then
        ( dosbox-x -nopromptfolder -c exit >/dev/null 2>&1 & sleep 6; pkill -x dosbox-x >/dev/null 2>&1 )
        conf="$(ls -t "$HOME/Library/Preferences/DOSBox-X"*"Preferences" 2>/dev/null | head -1)"
    fi
    [ -n "$conf" ] || { warn "could not locate the DOSBox-X config"; return 0; }

    if grep -q '^working directory option  *= *noprompt' "$conf"; then
        ok "DOSBox-X already set to noprompt"
    else
        cp "$conf" "$conf.bak-$(date +%Y%m%d%H%M%S)"
        sed -i '' 's/^\(working directory option  *= *\).*/\1noprompt/' "$conf"
        ok "DOSBox-X working directory set to noprompt"
        info "config: $conf"
    fi
    info "if it ever hangs with no window anyway: dosbox-x -nopromptfolder ..."
}

say "DOSBox-X startup"
configure_dosbox_x

# --- layout ------------------------------------------------------------------

say "Game directories"
for d in populous populous2 populous-tb simcity4 creeperworld ftl amiga/roms dos; do
    mkdir -p "$GAMES_DIR/$d"
done
ok "created under $GAMES_DIR"

# --- next steps --------------------------------------------------------------

say "Next steps (manual — these need your store logins)"
cat <<'NEXT'
  1. CrossOver: create ONE Windows 10 bottle named "Retro", enable D3DMetal.
     Everything Windows goes in it: Populous: The Beginning, SimCity 4 (GOG),
     Creeper World 3/4, FTL (Windows build, for Hyperspace + Multiverse).

  2. GOG (DRM-free, no launcher required) — buy and grab offline installers:
       Populous / Populous II          → DOS builds, use DOSBox-X, not GOG's
       Populous: The Beginning         → bottle, then patch 1.03 + Enhanced
                                          Edition from popre.net
       SimCity 4 Deluxe                → bottle (full Windows mod stack)
       FTL: Advanced Edition           → bottle (Windows build)

  3. Knuckle Cracker (knucklecracker.com/common/buy.php) — Creeper World,
     sold direct, DRM-free, no launcher. CW3 is the series peak, CW4 the most
     polished. Both go in the bottle.

  4. DOS classics:
       innoextract setup_populous_*.exe -d ~/Games/populous2
       dosbox-x -c "mount c ~/Games/populous2/app" -c "c:" -c "POPULOUS.EXE"

  5. Amiga (optional, best Populous II): Amiberry needs Kickstart ROMs.
     Buy Amiga Forever (~$10) and drop the ROMs in ~/Games/amiga/roms.

  6. Already own FTL / Creeper World on Steam? Both are DRM-free builds — you
     can pull the Windows depots with SteamCMD and never launch the client:
       ./steamcmd.sh +@sSteamCmdForcePlatformType windows +login <acct> \
         +force_install_dir ~/Games/ftl +app_update 212680 validate +quit
     App IDs: FTL 212680, Creeper World 3 280220, Creeper World 4 848480.

  Full reasoning, version picks and sources: docs/RETRO-GAMING-M4.md
NEXT

say "Done."
