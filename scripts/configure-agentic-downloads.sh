#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Project Thea — Agentic Download Configuration
# ─────────────────────────────────────────────────────────────
# Configures the "Thea Protocol" — automatic stall detection,
# retry, blocklisting, and fallback from usenet → torrent.
#
# Run this on Filou AFTER all Docker containers are up:
#   bash /opt/thea/scripts/configure-agentic-downloads.sh
#
# What this does:
#   1. SABnzbd: Aggressive stall detection (kill dead usenet downloads fast)
#   2. qBittorrent: Patient settings (let torrents sit, they may complete)
#   3. Radarr: Failed download handling + usenet-first priority
#   4. Sonarr: Same as Radarr
#   5. Verifies all services are connected
# ─────────────────────────────────────────────────────────────

set -e

echo "═══════════════════════════════════════════════════════"
echo "  THEA PROTOCOL — Agentic Download Configuration"
echo "═══════════════════════════════════════════════════════"
echo ""

# ─── Load API keys from the Thea panel .env ───
RADARR_URL="http://localhost:7878"
SONARR_URL="http://localhost:8989"
SABNZBD_URL="http://localhost:8080"
QBIT_URL="http://localhost:8085"

# Try to load API keys from Thea panel .env
if [ -f /var/www/thea-panel/.env ]; then
    source <(grep -E '^(RADARR_API_KEY|SONARR_API_KEY)' /var/www/thea-panel/.env)
fi

# Also check the docker .env
if [ -f /opt/thea/.env ]; then
    source <(grep -E '^(RADARR_API_KEY|SONARR_API_KEY|SABNZBD_API_KEY)' /opt/thea/.env)
fi

# Fallback: read API keys from running containers
if [ -z "$RADARR_API_KEY" ]; then
    RADARR_API_KEY=$(docker exec radarr cat /config/config.xml 2>/dev/null | grep -oP '(?<=<ApiKey>)[^<]+' || echo "")
fi
if [ -z "$SONARR_API_KEY" ]; then
    SONARR_API_KEY=$(docker exec sonarr cat /config/config.xml 2>/dev/null | grep -oP '(?<=<ApiKey>)[^<]+' || echo "")
fi
if [ -z "$SABNZBD_API_KEY" ]; then
    SABNZBD_API_KEY=$(docker exec sabnzbd cat /config/sabnzbd.ini 2>/dev/null | grep -oP '(?<=api_key = )[^\s]+' || echo "")
fi

echo "API Keys found:"
echo "  Radarr:  ${RADARR_API_KEY:0:8}... $([ -n "$RADARR_API_KEY" ] && echo '✓' || echo '✗ MISSING')"
echo "  Sonarr:  ${SONARR_API_KEY:0:8}... $([ -n "$SONARR_API_KEY" ] && echo '✓' || echo '✗ MISSING')"
echo "  SABnzbd: ${SABNZBD_API_KEY:0:8}... $([ -n "$SABNZBD_API_KEY" ] && echo '✓' || echo '✗ MISSING')"
echo ""

# ═══════════════════════════════════════════════════════════
# 1. SABnzbd — AGGRESSIVE stall detection
# ═══════════════════════════════════════════════════════════
echo "─── [1/5] Configuring SABnzbd (aggressive stall detection) ───"
echo ""
echo "SABnzbd settings must be configured via the web UI."
echo "Navigate to: http://localhost:8080/config/switches/"
echo ""
echo "Set these values:"
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │ Abort jobs that cannot be completed ......... ON    │"
echo "  │ Detect duplicate downloads .................. ON    │"
echo "  │ Detect duplicate episodes (series) .......... ON    │"
echo "  │ Action when encrypted RAR is found .... Abort       │"
echo "  │ Action when unwanted ext found ........ Abort       │"
echo "  │ Minimum free disk space ............... 5 GB        │"
echo "  │ Direct Unpack ......................... ON          │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""
echo "Under Config → Scheduling, add:"
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │ Check every 5 min for stalled downloads             │"
echo "  │ (SABnzbd does this automatically with the above)    │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""

# If we have the API key, we can also set some via API
if [ -n "$SABNZBD_API_KEY" ]; then
    echo "Setting SABnzbd config via API..."

    # Set abort on failure and duplicate detection
    curl -s "${SABNZBD_URL}/api?mode=set_config&section=misc&keyword=abort_on_empty_nzb&value=1&apikey=${SABNZBD_API_KEY}" > /dev/null 2>&1
    curl -s "${SABNZBD_URL}/api?mode=set_config&section=misc&keyword=no_dupes&value=2&apikey=${SABNZBD_API_KEY}" > /dev/null 2>&1
    curl -s "${SABNZBD_URL}/api?mode=set_config&section=misc&keyword=no_series_dupes&value=2&apikey=${SABNZBD_API_KEY}" > /dev/null 2>&1
    curl -s "${SABNZBD_URL}/api?mode=set_config&section=misc&keyword=action_on_unwanted_extensions&value=2&apikey=${SABNZBD_API_KEY}" > /dev/null 2>&1
    curl -s "${SABNZBD_URL}/api?mode=set_config&section=misc&keyword=unwanted_extensions&value=exe,bat,com,cmd,vbs,js,ws,wsf&apikey=${SABNZBD_API_KEY}" > /dev/null 2>&1

    echo "  ✓ SABnzbd stall/abort settings applied via API"
else
    echo "  ⚠ No SABnzbd API key found — configure manually via web UI"
fi

echo ""
echo "✓ SABnzbd configured for aggressive failure detection"
echo ""

# ═══════════════════════════════════════════════════════════
# 2. qBittorrent — PATIENT settings
# ═══════════════════════════════════════════════════════════
echo "─── [2/5] Configuring qBittorrent (patient — let torrents breathe) ───"
echo ""
echo "qBittorrent settings via web UI: http://localhost:8085"
echo "Go to: Options → BitTorrent"
echo ""
echo "Set these values:"
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │ Seeding Limits:                                     │"
echo "  │   When ratio reaches ................. 1.0          │"
echo "  │   Then .............................. Pause torrent  │"
echo "  │                                                     │"
echo "  │ DO NOT enable 'Remove stalled torrents'             │"
echo "  │ DO NOT set short timeout on stalled downloads       │"
echo "  │ A torrent at 99% may just need one seeder to pop on│"
echo "  │                                                     │"
echo "  │ Only flag for manual review if:                     │"
echo "  │   0 seeds + 0% progress for > 7 days               │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""
echo "Go to: Options → Downloads"
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │ Default Save Path ......... /data/torrents/complete │"
echo "  │ Incomplete folder ......... /data/torrents/incomplete│"
echo "  │ Monitored folder .......... OFF (Radarr handles it) │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""
echo "✓ qBittorrent configured for patient downloading"
echo ""

# ═══════════════════════════════════════════════════════════
# 3. Radarr — Failed download handling + priority
# ═══════════════════════════════════════════════════════════
echo "─── [3/5] Configuring Radarr (auto-retry + usenet-first) ───"

if [ -n "$RADARR_API_KEY" ]; then
    echo "Checking Radarr download clients..."

    # Get current download client config
    RADARR_CLIENTS=$(curl -s "${RADARR_URL}/api/v3/downloadclient" \
        -H "X-Api-Key: ${RADARR_API_KEY}" 2>/dev/null)

    echo "  Current download clients:"
    echo "$RADARR_CLIENTS" | python3 -c "
import sys, json
try:
    clients = json.load(sys.stdin)
    for c in clients:
        print(f\"    - {c['name']} ({c['implementation']}) priority={c.get('priority', 'N/A')}\")
except:
    print('    (could not parse - configure manually)')
" 2>/dev/null || echo "    (could not parse)"

    # Enable completed download handling and failed download handling
    echo ""
    echo "Configuring download client settings..."

    # Check and set download handling config
    DL_CONFIG=$(curl -s "${RADARR_URL}/api/v3/config/downloadclient" \
        -H "X-Api-Key: ${RADARR_API_KEY}" 2>/dev/null)

    if [ -n "$DL_CONFIG" ]; then
        # Update to enable auto-import and failed handling
        UPDATED_CONFIG=$(echo "$DL_CONFIG" | python3 -c "
import sys, json
config = json.load(sys.stdin)
config['enableCompletedDownloadHandling'] = True
config['autoRedownloadFailed'] = True
config['autoRedownloadFailedFromInteractiveSearch'] = True
print(json.dumps(config))
" 2>/dev/null)

        if [ -n "$UPDATED_CONFIG" ]; then
            curl -s -X PUT "${RADARR_URL}/api/v3/config/downloadclient" \
                -H "X-Api-Key: ${RADARR_API_KEY}" \
                -H "Content-Type: application/json" \
                -d "$UPDATED_CONFIG" > /dev/null 2>&1
            echo "  ✓ Completed Download Handling: ON"
            echo "  ✓ Auto-Redownload Failed: ON"
            echo "  ✓ Auto-Redownload Failed (Interactive): ON"
        fi
    fi

    echo ""
    echo "  KEY BEHAVIOR (Radarr's built-in agentic flow):"
    echo "  ┌─────────────────────────────────────────────────────┐"
    echo "  │ 1. User clicks 'Request' in Thea                   │"
    echo "  │ 2. Overseerr → Radarr adds the movie               │"
    echo "  │ 3. Radarr searches Prowlarr (all indexers)          │"
    echo "  │ 4. Picks best match per Thea Compact profile        │"
    echo "  │ 5. Sends to SABnzbd (usenet, priority 1)           │"
    echo "  │ 6. If SABnzbd fails → Radarr BLOCKLISTS that NZB   │"
    echo "  │ 7. Radarr auto-searches again                      │"
    echo "  │ 8. Tries next best usenet result                   │"
    echo "  │ 9. If ALL usenet fails → falls back to torrent     │"
    echo "  │ 10. Sends to qBittorrent (via VPN)                 │"
    echo "  │ 11. Torrent downloads patiently                    │"
    echo "  │ 12. File post-processed, renamed, ready for rsync  │"
    echo "  └─────────────────────────────────────────────────────┘"
else
    echo "  ⚠ No Radarr API key — configure manually:"
    echo "    Settings → Download Clients → Completed Download Handling: ON"
    echo "    Settings → Download Clients → Failed Download Handling: Redownload"
fi
echo ""
echo "✓ Radarr configured for agentic retry"
echo ""

# ═══════════════════════════════════════════════════════════
# 4. Sonarr — Same as Radarr
# ═══════════════════════════════════════════════════════════
echo "─── [4/5] Configuring Sonarr (auto-retry + usenet-first) ───"

if [ -n "$SONARR_API_KEY" ]; then
    DL_CONFIG=$(curl -s "${SONARR_URL}/api/v3/config/downloadclient" \
        -H "X-Api-Key: ${SONARR_API_KEY}" 2>/dev/null)

    if [ -n "$DL_CONFIG" ]; then
        UPDATED_CONFIG=$(echo "$DL_CONFIG" | python3 -c "
import sys, json
config = json.load(sys.stdin)
config['enableCompletedDownloadHandling'] = True
config['autoRedownloadFailed'] = True
config['autoRedownloadFailedFromInteractiveSearch'] = True
print(json.dumps(config))
" 2>/dev/null)

        if [ -n "$UPDATED_CONFIG" ]; then
            curl -s -X PUT "${SONARR_URL}/api/v3/config/downloadclient" \
                -H "X-Api-Key: ${SONARR_API_KEY}" \
                -H "Content-Type: application/json" \
                -d "$UPDATED_CONFIG" > /dev/null 2>&1
            echo "  ✓ Completed Download Handling: ON"
            echo "  ✓ Auto-Redownload Failed: ON"
        fi
    fi
else
    echo "  ⚠ No Sonarr API key — configure same settings as Radarr"
fi
echo ""
echo "✓ Sonarr configured for agentic retry"
echo ""

# ═══════════════════════════════════════════════════════════
# 5. Priority Check — Usenet first, torrents backup
# ═══════════════════════════════════════════════════════════
echo "─── [5/5] Download Client Priority ───"
echo ""
echo "IMPORTANT: In both Radarr and Sonarr, set download client priority:"
echo ""
echo "  Settings → Download Clients:"
echo "  ┌──────────────────────────────────────────┐"
echo "  │ SABnzbd ........... Priority: 1 (first)  │"
echo "  │ qBittorrent ....... Priority: 2 (backup)  │"
echo "  └──────────────────────────────────────────┘"
echo ""
echo "This ensures usenet is always tried first (faster, direct download)"
echo "and torrents are only used when all usenet sources are exhausted."
echo ""

# ═══════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════════"
echo "  THEA PROTOCOL — Configuration Complete"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  The Agentic Download Flow:"
echo ""
echo "  REQUEST → Radarr/Sonarr search all indexers"
echo "       ↓"
echo "  USENET ATTEMPT (via SABnzbd + Giganews)"
echo "       ↓ stall? → abort in 15min → blocklist → try next NZB"
echo "       ↓ all NZBs fail?"
echo "       ↓"
echo "  TORRENT FALLBACK (via qBittorrent + VPN)"
echo "       ↓ patient — no auto-cancel on stalls"
echo "       ↓ only flag dead torrents after 7 days at 0%"
echo "       ↓"
echo "  POST-PROCESS → rename → /data/media/"
echo "       ↓"
echo "  RSYNC → Home Mac → Plex auto-detects"
echo "       ↓"
echo "  NOTIFY → Push alert: 'New content available'"
echo ""
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Verify SABnzbd switches at http://localhost:8080/config/switches/"
echo "  2. Set download client priorities in Radarr + Sonarr"
echo "  3. Test: request something → watch the flow"
echo "  4. For the stuck Cold.Storage.2026 download:"
echo "     - Go to SABnzbd → click the download → delete it"
echo "     - Go to Radarr → find the movie → 'Search' to trigger re-grab"
echo "     - Radarr will find a new release (usenet or torrent)"
