#!/bin/bash
# Project Thea — move the games off the external drive onto the internal disk.
#
# Written because the external gets unplugged for lap use, and the whole library
# is under 2 GB: the external was sized for a modded SimCity 4 that was never
# bought. Copies rather than moves — the external copy stays as a backup until
# you delete it yourself.
#
#   ./move-games-internal.sh            # dry run, shows what it would do
#   ./move-games-internal.sh --go       # actually do it

set -uo pipefail

SRC="${SRC:-/Volumes/SisuGames/Games}"
DST="${DST:-$HOME/Games}"
BOTTLES_LINK="$HOME/Library/Application Support/CrossOver/Bottles"
GO=0; [ "${1:-}" = "--go" ] && GO=1

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
run()  { if [ "$GO" = 1 ]; then eval "$@"; else printf '  would: %s\n' "$*"; fi; }

say "Checks"
[ -d "$SRC" ] || { echo "  $SRC not found — plug the SisuGames drive in first." >&2; exit 1; }
ok "source present: $SRC"

NEED_KB=$(du -sk "$SRC" | awk '{print $1}')
FREE_KB=$(df -k "$HOME" | awk 'NR==2{print $4}')
printf '  need %s, free %s\n' "$(echo "$NEED_KB" | awk '{printf "%.1f GB", $1/1048576}')" \
                              "$(echo "$FREE_KB" | awk '{printf "%.1f GB", $1/1048576}')"
[ "$FREE_KB" -gt $((NEED_KB * 2)) ] || { echo "  not enough headroom on the internal disk." >&2; exit 1; }
ok "internal disk has room"

# Nothing may be running out of the bottle while it is copied.
if pgrep -f "CrossOver.app/Contents/SharedSupport" >/dev/null 2>&1 || pgrep -x wineserver >/dev/null 2>&1; then
    warn "a bottle process is running — quitting it before the copy"
    run 'pkill -f "\.exe" 2>/dev/null; pkill -x wineserver 2>/dev/null; sleep 3'
fi

say "Copy"
run "mkdir -p '$DST'"
# -a preserves everything; the trailing slash copies contents, not the dir itself
run "rsync -a --info=progress2 '$SRC/' '$DST/'"
ok "copied to $DST"

say "Repoint CrossOver bottles"
# The bottle keeps the same path AS CROSSOVER SEES IT (~/Library/.../Bottles),
# so nothing inside the bottle needs rewriting — only what the symlink targets.
if [ -L "$BOTTLES_LINK" ] || [ ! -e "$BOTTLES_LINK" ]; then
    run "ln -sfn '$DST/crossover-bottles' '$BOTTLES_LINK'"
    ok "Bottles -> $DST/crossover-bottles"
else
    warn "$BOTTLES_LINK is a real directory, not a symlink — left alone"
fi

say "Rebuild launchers"
HERE="$(cd "$(dirname "$0")" && pwd)"
CW="$DST/crossover-bottles/SisuGames/drive_c/Program Files (x86)/KnuckleCracker/Creeper World Anniversary Edition/CreeperWorld.exe"
run "'$HERE/make-launcher.sh' bottle 'FTL' '$DST/ftl/FTLGame.exe'"
run "'$HERE/make-launcher.sh' bottle 'Creeper World' '$CW'"

say "Done"
cat <<NEXT
  The copy on the external is untouched. Play both games from ~/Applications to
  confirm, then delete /Volumes/SisuGames/Games yourself when you are happy.

  Note the launchers no longer check for a mounted volume, because the games are
  on the boot disk now — that check only applies to a GAMES_DIR under /Volumes.
NEXT
