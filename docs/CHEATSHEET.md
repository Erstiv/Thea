# Project Thea — Management Cheatsheet

---

## Quick Access (SSH Tunnels)

Open all web UIs at once from your Mac:
```bash
ssh -L 9696:localhost:9696 \
    -L 8989:localhost:8989 \
    -L 7878:localhost:7878 \
    -L 8686:localhost:8686 \
    -L 6767:localhost:6767 \
    -L 8080:localhost:8080 \
    -L 8085:localhost:8085 \
    -L 5055:localhost:5055 \
    filou
```

Then open in browser:
| URL | Service |
|-----|---------|
| localhost:9696 | Prowlarr (indexers) |
| localhost:8989 | Sonarr (TV) |
| localhost:7878 | Radarr (movies) |
| localhost:8686 | Lidarr (music) |
| localhost:6767 | Bazarr (subtitles) |
| localhost:8080 | SABnzbd (Usenet downloads) |
| localhost:8085 | qBittorrent (torrent downloads) |
| localhost:5055 | Overseerr (request UI) |

---

## Docker Commands

All commands run from `/opt/thea/` on Hetzner:

```bash
# Status of all containers
docker compose ps

# Start everything
docker compose up -d

# Stop everything
docker compose down

# Restart a single service
docker compose restart sonarr

# View logs (live follow)
docker compose logs -f radarr

# View logs for specific service (last 50 lines)
docker compose logs --tail 50 sabnzbd

# Update all containers to latest versions
docker compose pull && docker compose up -d

# Update a single service
docker compose pull radarr && docker compose up -d radarr

# Check disk usage
df -h /data
du -sh /data/usenet/* /data/torrents/* /data/media/*
```

---

## Common Tasks

### "I want to add a specific movie"
1. Go to Radarr (localhost:7878) → Add New → search for it
2. Select quality profile "Thea Compact"
3. Click Add Movie → it'll search indexers and download automatically
4. Or: use Overseerr (localhost:5055) — prettier search interface

### "I want to add a TV show"
1. Go to Sonarr (localhost:8989) → Add New → search
2. Choose which seasons/episodes to monitor
3. Select quality profile "Thea Compact"
4. It'll grab existing episodes and monitor for new ones

### "I want to add a whole list of movies (e.g., IMDB Top 250)"
1. Go to Radarr → Settings → Lists → Add
2. Choose "MDBList" or "IMDb List" or "Trakt List"
3. Paste the list URL
4. Set quality profile to "Thea Compact"
5. Enable "Search on Add" and "Auto Add"
6. Radarr will import the entire list and start downloading

### "I want to see what's downloading right now"
- SABnzbd (localhost:8080) — shows Usenet downloads
- qBittorrent (localhost:8085) — shows torrent downloads
- Radarr/Sonarr Activity tab — shows what's queued

### "A download is stuck or failed"
1. Check the Activity tab in Radarr/Sonarr
2. Click the failed item → Blocklist and Search
3. This removes the bad result and searches for a new one
4. If it keeps failing, the content might not be available on your indexers

### "I want to manually search for a specific release"
1. In Radarr/Sonarr, find the movie/episode
2. Click the magnifying glass icon (Manual Search)
3. Browse available releases, check size and quality
4. Click the download arrow on the one you want

### "I want to import my existing library"
1. Radarr → Library Import (or Sonarr equivalent)
2. Point it at your Plex library folder
3. It'll scan, match everything against TMDB/TVDB
4. You'll see a list to confirm matches
5. It can optionally rename everything to Plex format
6. After import, it monitors for upgrades (won't re-download what you have)

---

## Disk Space Management

Hetzner has ~120GB buffer. Monitor it:

```bash
# Quick check
ssh filou "df -h /data"

# What's using space
ssh filou "du -sh /data/*/* | sort -rh | head -20"

# Emergency: delete completed downloads that already transferred
ssh filou "find /data/media -mindepth 2 -type d -empty -delete"
```

The rsync script uses `--remove-source-files` which automatically deletes files from Hetzner after they transfer to your Mac. If space gets tight, check that rsync is running (`cat /tmp/thea-sync.log`).

---

## VPN Check (Torrents)

Verify qBittorrent is going through VPN:
```bash
# Check gluetun VPN status
docker exec gluetun wget -qO- ifconfig.me
# Should show VyprVPN IP, NOT your Hetzner IP (178.156.251.26)

# If it shows your Hetzner IP, VPN is down — restart:
docker compose restart gluetun
```

---

## Adding a New Indexer

1. Go to Prowlarr (localhost:9696) → Indexers → Add
2. Search for your indexer (e.g., NZBgeek, DrunkenSlug, MyAnonaMouse)
3. Enter your API key / credentials
4. Test → Save
5. Prowlarr automatically syncs it to Sonarr/Radarr/Lidarr

---

## Troubleshooting

**Nothing is downloading:**
- Check Prowlarr has working indexers (green status)
- Check SABnzbd/qBittorrent are connected (Sonarr → Settings → Download Clients)
- Check the Activity tab for errors

**rsync not running:**
```bash
# On your Plex Mac:
launchctl list | grep thea
cat /tmp/thea-sync.log
```

**Container won't start:**
```bash
docker compose logs <service-name>
# Usually a config or permission issue
```

**VPN leaking:**
```bash
# Kill switch is built into gluetun — if VPN drops, qBittorrent loses network
# Verify: docker exec gluetun wget -qO- ifconfig.me
# If gluetun is down, qBittorrent can't download (this is the intended behavior)
```

---

## Backup

All config is in `/opt/thea/configs/`. Back it up periodically:
```bash
ssh filou "tar -czf /root/thea-configs-backup-$(date +%Y%m%d).tar.gz /opt/thea/configs/"
scp filou:/root/thea-configs-backup-*.tar.gz ~/backups/
```

---

## First-Time Setup Walkthrough

After `docker compose up -d`, configure services in this order:

1. **Prowlarr** (localhost:9696) — set auth, add indexers, add FlareSolverr proxy (localhost:8191)
2. **SABnzbd** (localhost:8080) — add Giganews server (news.giganews.com, port 563 SSL, your credentials)
3. **qBittorrent** (localhost:8085) — default password in logs: `docker compose logs qbittorrent | grep password`
4. **Radarr** (localhost:7878) — Settings → Download Clients (add SABnzbd + qBit), set "Thea Compact" as default profile, add lists from MDBList
5. **Sonarr** (localhost:8989) — same as Radarr
6. **Lidarr** (localhost:8686) — same pattern
7. **Bazarr** (localhost:6767) — connect to Sonarr + Radarr, set subtitle languages (English + any others)
8. **Overseerr** (localhost:5055) — connect to Plex + Radarr + Sonarr
9. **Recyclarr** — edit `/opt/thea/configs/recyclarr/recyclarr.yml`, add API keys from Radarr/Sonarr

Get API keys: In each Arr app → Settings → General → API Key
