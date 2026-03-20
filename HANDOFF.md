# Project Thea — Handoff
**Last updated:** March 19, 2026

Project Thea is Elliot's home media automation system. It runs a full "Arr stack" on the Hetzner server (Filou), downloads content via VPN, and syncs it to a home Plex server. There's also a custom Netflix-like web UI (the "Control Panel") that wraps everything.

---

## Architecture Overview

```
User → quietferal.com (Overseerr or Control Panel)
           ↓ request
     Radarr / Sonarr
           ↓ search
     Prowlarr (indexers: TPB, YTS, NZBgeek)
           ↓
     qBittorrent (via Gluetun/ProtonVPN)  OR  SABnzbd (Usenet via Giganews)
           ↓ download to /data/media/
     rsync (cron, every 15 min, runs on Plex Mac)
           ↓ pull to /Volumes/Luchagaido/
     Plex (home MacBook Pro 2019, 99.116.182.99:32400)
           ↓
     Watch
```

---

## Infrastructure

### Hetzner Filou (server)
- **IP:** 178.156.251.26
- **SSH:** `ssh filou` (alias on Work Mac and Travel Mac) or `ssh root@178.156.251.26`
- **OS:** Ubuntu, Ashburn VA
- **Docker compose:** `/opt/thea/docker/docker-compose.yml`
- **Env file:** `/opt/thea/docker/.env` (API keys, VPN creds)
- **Media storage:** `/data/media/movies/`, `/data/media/tv/`, `/data/media/music/`
- **Torrent downloads:** `/data/torrents/`
- **⚠️ Filou needs a reboot** — kernel upgrade pending. `ssh filou 'reboot'` (comes back in ~60s)

### Plex Mac (home media server)
- **Machine:** MacBook Pro 15" 2019, home network
- **IP:** 99.116.182.99 (home network) / jers@192.168.0.147 (local SSH alias `ssh plex`)
- **Plex port:** 32400
- **Storage:**
  - `/Volumes/Chaos/` — legacy 20TB RAID, ~16TB used, ~6,000 movies. **DO NOT rsync --delete against this.**
  - `/Volumes/Luchagaido/` — 12TB RAID, all new content goes here
- **Sleep:** Configured to never sleep (`sudo systemsetup -setcomputersleep Never`)
- **rsync script:** `~/sync-media.sh` (cron every 15 min)

### Plex Library Sections
| Key | Library | Path |
|-----|---------|------|
| 5 | Movies (Chaos) | `/Volumes/Chaos/Movies` |
| 6 | TV (Chaos) | `/Volumes/Chaos/TV Shows` |
| 7 | Movies (Luchagaido) | `/Volumes/Luchagaido/Movies` |
| 8 | TV (Luchagaido) | `/Volumes/Luchagaido/TV Shows` |

Note: Sections 7 and 8 were previously separate libraries but should be merged into 5 and 6 (add Luchagaido path to each, delete separate Luchagaido libraries). Check Plex to confirm this was done.

---

## Docker Stack

All containers defined in `/opt/thea/docker/docker-compose.yml` on Filou.

| Container | Purpose | Port |
|-----------|---------|------|
| Gluetun | ProtonVPN VPN container | — |
| qBittorrent | Torrent client (runs through Gluetun) | 8085 (via gluetun) |
| SABnzbd | Usenet client | 8080 |
| Prowlarr | Indexer manager | 9696 |
| Radarr | Movie automation | 7878 |
| Sonarr | TV automation | 8989 |
| Lidarr | Music automation | 8686 |
| Bazarr | Subtitle automation | 6767 |
| Overseerr | Request portal | 5055 |

**Useful commands (run on Filou):**
```bash
cd /opt/thea/docker

docker compose ps                        # check all container status
docker compose logs radarr --tail=50     # check a specific service's logs
docker compose restart qbittorrent       # restart one service
docker compose up -d                     # start everything
docker compose down                      # stop everything
```

**⚠️ qBittorrent note:** qBittorrent runs inside the Gluetun VPN container network — it is NOT directly accessible on the host. Access it only through the gluetun port (8085). Direct host port access won't work.

---

## Credentials & API Keys

All secrets live in `/opt/thea/docker/.env` on Filou and `/var/www/thea-panel/.env` on Filou.

| Service | Username | Password / Key |
|---------|----------|---------------|
| Filou SSH | root | key-based (`ssh filou`) |
| ProtonVPN OpenVPN | 88Kjb2bgTvs9Y5gD | edtbCUYDI37tjXhBvuCDucdFDeetrryt |
| Giganews / SABnzbd | elliots@gmail.com | jr1752 |
| qBittorrent | admin | Megahertz1! (original) / adminadmin123 (attempted reset — unconfirmed) |
| Radarr / Sonarr / all Arr | admin | Megahertz1! |
| Plex Token | — | PQAmJ4YXSKexz1ubB-Cb |
| Prowlarr API | — | bc84d67b871c4070b3d570e4d0288545 |
| Radarr API | — | 9008a9c7473d47d3a43e026731568f06 |
| Sonarr API | — | e068e976a5704fd0a74a4abc7bbb393c |
| Lidarr API | — | b6c7831f22ac414fb1846fa84bc223c6 |
| SABnzbd API | — | 5ed5e9c7119e410c88fcc72db9619c1f |
| Overseerr API | — | MTc3MzExMjU0MDMyNjQ2YmNhNGQ5LTdjZGMtNDJiZC04NWRmLWFkMmY0NzgwN2EwMw== |
| MDBList API | — | 41aykwi9ohfthl3b923ngujx3 |

**Control Panel `.env`** (at `/var/www/thea-panel/.env` on Filou):
```
PLEX_SERVER_URL=http://99.116.182.99:32400
PLEX_TOKEN=PQAmJ4YXSKexz1ubB-Cb
RADARR_API_KEY=9008a9c7473d47d3a43e026731568f06
SONARR_API_KEY=e068e976a5704fd0a74a4abc7bbb393c
MDBLIST_API_KEY=41aykwi9ohfthl3b923ngujx3
SABNZBD_API_KEY=5ed5e9c7119e410c88fcc72db9619c1f
OVERSEERR_API_KEY=MTc3MzExMjU0MDMyNjQ2YmNhNGQ5LTdjZGMtNDJiZC04NWRmLWFkMmY0NzgwN2EwMw==
```

---

## rsync Pipeline (Plex Mac)

**Script:** `~/sync-media.sh` on Plex Mac
**Cron:** `*/15 * * * * /bin/bash ~/sync-media.sh` (runs every 15 min)
**Log:** `/Volumes/Luchagaido/sync.log`

**Current working script:**
```bash
#!/bin/bash
SERVER="root@178.156.251.26"
LOCAL_BASE="/Volumes/Luchagaido"
LOG_FILE="/Volumes/Luchagaido/sync.log"
mkdir -p "$LOCAL_BASE/Movies" "$LOCAL_BASE/TV Shows" "$LOCAL_BASE/Music"
echo "===== Sync started: $(date) =====" >> "$LOG_FILE"
rsync --archive --verbose --partial --progress "$SERVER:/data/media/movies/" "$LOCAL_BASE/Movies/" >> "$LOG_FILE" 2>&1
rsync --archive --verbose --partial --progress "$SERVER:/data/media/tv/" "$LOCAL_BASE/TV Shows/" >> "$LOG_FILE" 2>&1
rsync --archive --verbose --partial --progress "$SERVER:/data/media/music/" "$LOCAL_BASE/Music/" >> "$LOG_FILE" 2>&1
echo "===== Sync finished: $(date) =====" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
PLEX_TOKEN="PQAmJ4YXSKexz1ubB-Cb"
echo "Triggering Plex scan..." >> "$LOG_FILE"
for KEY in 5 6 7 8; do
  curl -s "http://localhost:32400/library/sections/$KEY/refresh?X-Plex-Token=$PLEX_TOKEN" >> "$LOG_FILE" 2>&1
done
echo "Plex scan triggered." >> "$LOG_FILE"
echo "Cleaning synced files from Filou..." >> "$LOG_FILE"
for DIR in "$LOCAL_BASE/Movies/"/*/; do
  DIRNAME=$(basename "$DIR")
  ssh -o BatchMode=yes root@178.156.251.26 "rm -rf \"/data/media/movies/$DIRNAME\"" 2>/dev/null && echo "Deleted from Filou: $DIRNAME" >> "$LOG_FILE"
done
```

**What it does:** rsync pulls movies/tv/music from Filou → Luchagaido, triggers a Plex library scan on all 4 sections, then deletes the synced movie folders from Filou to keep disk space free.

**SSH config on Plex Mac** (`~/.ssh/config`):
```
Host 178.156.251.26
    IdentityFile ~/.ssh/id_filou
    User root
```

**Trigger manually** (from Plex Mac): `bash ~/sync-media.sh`

---

## Control Panel (Thea Web UI)

The custom Netflix-like UI that wraps Overseerr + Plex. Lives at `project-thea/control-panel/`.

**Live at:** https://quietferal.com (served by Nginx → PM2 → Node.js on Filou)
**Filou path:** `/var/www/thea-panel/`
**PM2 process name:** `thea-panel`
**Port:** 3005 (internal, Nginx proxies to it)

### Stack
- **Backend:** Node.js / Express (`server/`)
- **Frontend:** React + Vite + Tailwind (`client/`)
- **DB:** SQLite at `/var/www/thea-panel/thea.db` — stores users, requests, sessions

### Key Source Files
```
control-panel/
  server/
    index.js              ← Express app, auth, sessions
    db.js                 ← SQLite setup
    middleware/auth.js    ← JWT auth middleware
    routes/
      auth.js             ← login, register, invite codes
      media.js            ← THE BIG ONE: Plex cache, TMDB, Radarr/Sonarr status, requests
      admin.js            ← pending approvals, user management, request queue
      discovery.js        ← trending, recommendations
      library.js          ← Plex library browsing
      queue.js            ← download queue status
      services.js         ← health checks
      settings.js         ← admin settings
  client/src/
    pages/
      Home.jsx            ← main browse page
      Search.jsx          ← search + request
      Detail.jsx          ← movie/show detail, Watch/Request buttons
      Admin.jsx           ← admin panel (queue, approvals, users)
      Requests.jsx        ← user's own request history
      Login.jsx
    lib/api.js            ← all API calls
    components/           ← Header, MediaCard, MediaRow
```

### How Requests Work
1. Non-admin user requests a movie → stored as `pending_approval` in local DB
2. Admin sees it in Admin → Queue → Pending Approval
3. Admin approves → request sent to Overseerr → Radarr picks it up → downloads
4. Admin's own requests auto-approve and go straight to Overseerr

### Plex Cache
- On server start, fetches all movies/shows from Plex via API, builds TMDB ID → ratingKey map
- Refreshes every 30 minutes
- Manual refresh: `curl -X POST http://localhost:3005/api/media/plex-cache/refresh` (run on Filou)
- Stats: `curl http://localhost:3005/api/media/plex-cache/stats`
- Current stats at last check: 5,850 movies, 1,092 shows

### Deploy Method
```bash
# From Work Mac — scp changed files to Filou, build there
scp ~/Documents/Elliot\ Projects/CoWork\ Projects/project-thea/control-panel/server/routes/media.js filou:/var/www/thea-panel/server/routes/media.js
# ... (scp each changed file)
ssh filou 'cd /var/www/thea-panel/client && npm run build && pm2 restart thea-panel'
```

Or use `control-panel/deploy.sh` if it's up to date.

**Note:** Node.js is NOT installed on Work Mac — always build on Filou.

---

## Radarr & Sonarr

### Radarr Quality Profile (HD-1080p, ID 4)
- Remux-1080p: **disabled** (was grabbing 20-40GB files)
- WEB-DL 1080p is the target; Bluray-1080p is fallback
- `upgradeAllowed: true`, cutoff at WEB 1080p group
- Size limits (MB per minute): HDTV preferred=50/max=80, WEB preferred=68/max=100, Bluray preferred=83/max=125

### Radarr Movie Library
- 5,848 movies bulk-imported from Plex Chaos library on March 17 — all **unmonitored**
- Root folder: `/data/media/movies`
- These are just for status tracking — Radarr won't try to re-download them
- A few monitored movies (requested via Overseerr): Cold Storage, Wuthering Heights, Run Lola Run, others

### Sonarr TV Library
- ~417 TV shows bulk-imported from Chaos library — all set to `monitor: future`
- Sonarr only looks for new episodes, not backdating entire histories
- Fixed wrong matches: Dragon's Den → BBC (TVDB 79836), Hell's Kitchen → US (TVDB 74897), Carnivàle → HBO (TVDB 70860)

### Accessing Radarr/Sonarr UI (via SSH tunnel)
```bash
# On your Mac:
ssh -L 7878:localhost:7878 filou   # then open localhost:7878 for Radarr
ssh -L 8989:localhost:8989 filou   # then open localhost:8989 for Sonarr
ssh -L 9696:localhost:9696 filou   # then open localhost:9696 for Prowlarr
```

---

## Known Issues & Pending Tasks

### 🔴 Immediate (fix next session)

**1. Reboot Filou**
Kernel upgrade has been pending for multiple sessions. Just do it:
```bash
ssh filou 'reboot'
```
Wait ~60 seconds, then reconnect. All Docker containers should auto-restart (they have `restart: unless-stopped`).

**2. Fix qBittorrent (Forbidden)**
- Login fails with 403 Forbidden
- Password reset via sed on config file was attempted but may not have taken effect
- **Fix:** After Filou reboot (above), the container will restart and reload its config. Try logging in with `adminadmin123` first, then `Megahertz1!`
- If still broken: `cd /opt/thea/docker && docker compose restart qbittorrent` and wait 30 seconds
- Access: can only reach qBittorrent via `ssh -L 8085:localhost:8085 filou` then `localhost:8085` (it's behind Gluetun)

**3. Fix Radarr Auto-Import**
- Root cause: qBittorrent isn't creating a `radarr/` subfolder in `/data/torrents/`
- This means downloads go to `/data/torrents/` root instead of `/data/torrents/radarr/`
- Radarr only monitors `/data/torrents/radarr/` so it never imports them
- **Fix chain:** Fix qBittorrent → Radarr Settings → Download Clients → Test → should pass → next download will create the folder automatically
- The qBittorrent config has `movieCategory: radarr` set correctly — it just can't connect to push the job

**4. Trigger Movie Downloads**
Once qBittorrent is working:
- These movies are monitored in Radarr but not downloading: Cold Storage, Wuthering Heights, Run Lola Run (the Jewels Run), and ~10 others
- In Radarr UI: Movies → select monitored/missing → Search Selected
- Or via API: `curl -X POST "http://localhost:7878/api/v3/command" -H "X-Api-Key: 9008a9c7473d47d3a43e026731568f06" -d '{"name":"MissingMoviesSearch"}'` (run on Filou)

### 🟡 Soon

**5. Plex TV Episode Metadata**
Shows play but have no episode data in Plex. Fix:
- Sonarr: Settings → Library → Refresh & Scan
- Plex: Settings → Troubleshooting → Clean Bundles + Empty Trash → refresh TV library

**6. Verify Bulk-Imported Movies Are Unmonitored**
5,848 movies were bulk-imported into Radarr as unmonitored. Spot-check a few in the Radarr UI to confirm they show as unmonitored (grey, not blue). If any are accidentally monitored, Radarr will try to re-download content already in Plex.

**7. overseerr.quietferal.com**
Set up a subdomain so Overseerr has its own URL separate from the Control Panel:
```bash
# On Filou:
certbot --nginx -d overseerr.quietferal.com
```
(DNS A record for overseerr.quietferal.com → 178.156.251.26 needs to be added first in your DNS provider)

**8. Tailscale on Plex Mac**
Currently can only SSH to Plex Mac when on home network. Tailscale would allow remote access from anywhere. Install at tailscale.com, add Plex Mac to your Tailnet.

### 🟢 Future / Nice to Have

- **MDBList integration** — API key `41aykwi9ohfthl3b923ngujx3` in .env, needs implementation in control panel for ratings/list data
- **Notifiarr** — push alerts when content arrives
- **Bazarr subtitle providers** — connected to Radarr/Sonarr but no providers configured yet
- **Tautulli** — Plex analytics (watch history, hours watched) — add as another Docker container
- **Fix Plex server friendly name** — currently "Elliots-MacBook-Pro" in Plex settings
- **snap.quietferal.com** — "Snap & Grab" movie night app (planned, not started). Reserved in Nginx config → localhost:3010.
- **Giganews** — VyprVPN third-party OpenVPN is broken. Contact support or cancel.

---

## SSH Shortcuts
```bash
ssh filou                    # Hetzner server (root@178.156.251.26)
ssh plex                     # Plex Mac at home (jers@192.168.0.147) — from Work Mac on same network
ssh jers@192.168.0.147       # Plex Mac (direct)

# SSH tunnels for Arr UIs:
ssh -L 7878:localhost:7878 filou   # Radarr → localhost:7878
ssh -L 8989:localhost:8989 filou   # Sonarr → localhost:8989
ssh -L 9696:localhost:9696 filou   # Prowlarr → localhost:9696
ssh -L 8080:localhost:8080 filou   # SABnzbd → localhost:8080
ssh -L 8085:localhost:8085 filou   # qBittorrent (via Gluetun) → localhost:8085
ssh -L 8385:localhost:8384 filou   # Syncthing → localhost:8385
```

---

## Session History (summary)

**March 19, 2026** — rsync pipeline fully working end-to-end (with Plex scan + Filou cleanup). Disk freed 84% → 23%. "What the Bleep Do We Know" manually imported. Plex Mac sleep prevention set. qBittorrent still Forbidden (reset attempted, not confirmed). Radarr auto-import still broken (linked to qBittorrent issue). SSH MCP plugin for Cowork not achieved — copy-paste remains the method. Aider v0.86.2 installed on Filou.

**March 17, 2026 (Session 2)** — "Content not found" Plex bug fixed (reverse ratingKey cache). Admin approval flow built. Radarr quality profile tuned (no Remux, upgrade to WEB-DL). Sonarr wrong matches fixed. 5,848 movies bulk-imported to Radarr (unmonitored). rsync investigation started.

**March 17, 2026 (Session 1)** — rsync --delete bug fixed (was deleting Chaos TV). rsync redirected to Luchagaido. Plex "in library" fix (6,000 Chaos movies now show correct status). Sonarr bulk import (~417 shows).

**March 11–12, 2026** — Full Arr stack deployed. VyprVPN → ProtonVPN switch. First download successful. Overseerr live at quietferal.com. rsync set up on Plex Mac.

---

## To Resume

Start a new Cowork session and say:
**"Read HANDOFF.md from CoWork Projects/project-thea and let's continue with Project Thea."**
