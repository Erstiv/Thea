#!/bin/bash
# Project Thea — rsync pull setup for Plex Mac
# Run this on the Plex Mac (MacBook Pro 15" 2019)
# It sets up a cron job that pulls new media from Hetzner every 15 minutes

HETZNER="root@178.156.251.26"
REMOTE_MEDIA="/data/media"
LOCAL_MEDIA="$HOME/Media/Thea"

echo "=== Project Thea — rsync Setup ==="
echo ""

# Create local directories
echo "Creating local media directories..."
mkdir -p "$LOCAL_MEDIA/movies"
mkdir -p "$LOCAL_MEDIA/tv"
mkdir -p "$LOCAL_MEDIA/music"
mkdir -p "$HOME/.thea/logs"

# Test SSH connection
echo "Testing SSH connection to Hetzner..."
if ssh -o BatchMode=yes -o ConnectTimeout=5 $HETZNER "echo ok" 2>/dev/null; then
    echo "  SSH key auth works!"
else
    echo "  SSH key auth not set up. Setting up now..."
    # Generate key if needed
    if [ ! -f "$HOME/.ssh/id_ed25519" ] && [ ! -f "$HOME/.ssh/id_rsa" ]; then
        echo "  Generating SSH key..."
        ssh-keygen -t ed25519 -f "$HOME/.ssh/id_ed25519" -N "" -q
    fi
    # Copy key to Hetzner
    echo "  Copying SSH key to Hetzner (you'll need to enter the root password once)..."
    ssh-copy-id -i "$HOME/.ssh/id_ed25519.pub" $HETZNER
    # Test again
    if ssh -o BatchMode=yes -o ConnectTimeout=5 $HETZNER "echo ok" 2>/dev/null; then
        echo "  SSH key auth now works!"
    else
        echo "  ERROR: SSH key setup failed. Please set up SSH keys manually."
        exit 1
    fi
fi

# Create the rsync script
echo "Creating rsync pull script..."
cat > "$HOME/.thea/sync-media.sh" << 'SCRIPT'
#!/bin/bash
# Project Thea — Media Sync Script
# Pulls new media from Hetzner to local Plex library

HETZNER="root@178.156.251.26"
REMOTE_MEDIA="/data/media"
LOCAL_MEDIA="$HOME/Media/Thea"
LOG="$HOME/.thea/logs/sync-$(date +%Y%m%d).log"

echo "$(date): Starting media sync..." >> "$LOG"

# Sync movies
rsync -avz --progress --ignore-existing \
    "$HETZNER:$REMOTE_MEDIA/movies/" \
    "$LOCAL_MEDIA/movies/" >> "$LOG" 2>&1

# Sync TV shows
rsync -avz --progress --ignore-existing \
    "$HETZNER:$REMOTE_MEDIA/tv/" \
    "$LOCAL_MEDIA/tv/" >> "$LOG" 2>&1

# Sync music
rsync -avz --progress --ignore-existing \
    "$HETZNER:$REMOTE_MEDIA/music/" \
    "$LOCAL_MEDIA/music/" >> "$LOG" 2>&1

echo "$(date): Sync complete." >> "$LOG"

# Clean up old logs (keep 7 days)
find "$HOME/.thea/logs" -name "sync-*.log" -mtime +7 -delete 2>/dev/null
SCRIPT

chmod +x "$HOME/.thea/sync-media.sh"

# Set up cron job (every 15 minutes)
echo "Setting up cron job (every 15 minutes)..."
CRON_LINE="*/15 * * * * $HOME/.thea/sync-media.sh"

# Add to crontab if not already there
(crontab -l 2>/dev/null | grep -v "sync-media.sh"; echo "$CRON_LINE") | crontab -

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Local media folder: $LOCAL_MEDIA"
echo "  - movies:  $LOCAL_MEDIA/movies"
echo "  - tv:      $LOCAL_MEDIA/tv"
echo "  - music:   $LOCAL_MEDIA/music"
echo ""
echo "Sync runs every 15 minutes automatically."
echo "To run manually:  ~/.thea/sync-media.sh"
echo "To check logs:    cat ~/.thea/logs/sync-$(date +%Y%m%d).log"
echo ""
echo "NEXT STEP: Point Plex to $LOCAL_MEDIA for your libraries."
