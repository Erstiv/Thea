#!/bin/bash
# Project Thea — Media Sync Script
# Runs on the HOME Plex Mac (MBP 2019) via launchd every 30 minutes.
# Pulls completed, renamed media from Hetzner → local Plex library.
#
# Install:
#   1. Edit the paths below to match your Plex library locations
#   2. chmod +x thea-sync.sh
#   3. Install the launchd plist (see thea-sync.plist)
#
# Manual run:  ./thea-sync.sh
# Check logs:  cat /tmp/thea-sync.log

set -euo pipefail

# ─── CONFIGURATION ───────────────────────────────────────────
# Remote (Hetzner)
REMOTE_HOST="filou"                           # SSH alias (already configured)
REMOTE_MOVIES="/data/media/movies/"
REMOTE_TV="/data/media/tv/"
REMOTE_MUSIC="/data/media/music/"

# Local (Plex library on RAID)
# ⚠️  UPDATE THESE to match your actual Plex library paths
LOCAL_MOVIES="/Volumes/Media/Movies/"
LOCAL_TV="/Volumes/Media/TV Shows/"
LOCAL_MUSIC="/Volumes/Media/Music/"

# Logging
LOG_FILE="/tmp/thea-sync.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ─── FUNCTIONS ───────────────────────────────────────────────

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

sync_category() {
    local name="$1"
    local remote="$2"
    local local_dir="$3"

    # Skip if local directory doesn't exist
    if [ ! -d "$local_dir" ]; then
        log "⚠️  $name: Local directory $local_dir not found — skipping"
        return
    fi

    log "Syncing $name..."

    # rsync flags:
    #   -avz     = archive mode, verbose, compress during transfer
    #   --remove-source-files = delete from Hetzner after successful transfer
    #                           (frees disk space on the 160GB SSD)
    #   --progress = show transfer progress
    #   --timeout=300 = 5 min timeout per file
    #   --partial = keep partial files (resume interrupted transfers)
    #   --min-size=1K = skip empty placeholder files

    rsync -avz \
        --remove-source-files \
        --progress \
        --timeout=300 \
        --partial \
        --min-size=1K \
        "${REMOTE_HOST}:${remote}" \
        "${local_dir}" \
        2>&1 | tail -5 >> "$LOG_FILE"

    if [ $? -eq 0 ]; then
        log "✅ $name sync complete"
    else
        log "❌ $name sync failed (exit code $?)"
    fi
}

cleanup_empty_dirs() {
    # After --remove-source-files, empty directories remain on Hetzner.
    # Clean them up.
    log "Cleaning empty directories on Hetzner..."
    ssh "$REMOTE_HOST" "find /data/media -mindepth 2 -type d -empty -delete 2>/dev/null" || true
}

# ─── MAIN ────────────────────────────────────────────────────

log "=== Thea Sync Starting ==="

# Check SSH connectivity first
if ! ssh -o ConnectTimeout=10 "$REMOTE_HOST" "echo ok" &>/dev/null; then
    log "❌ Cannot reach Hetzner — aborting"
    exit 1
fi

sync_category "Movies" "$REMOTE_MOVIES" "$LOCAL_MOVIES"
sync_category "TV Shows" "$REMOTE_TV" "$LOCAL_TV"
sync_category "Music" "$REMOTE_MUSIC" "$LOCAL_MUSIC"
cleanup_empty_dirs

log "=== Thea Sync Complete ==="
echo "" >> "$LOG_FILE"
