# Project Thea — Home Media Automation System
**Last updated:** March 9, 2026

---

## Overview

Project Thea is a fully automated media collection and organization system. The Hetzner CPX31 server acts as the **brain and downloader** — running the Arr suite, finding content, downloading through VPN/Usenet, renaming files, and staging them for transfer. The home MacBook Pro (2019) runs Plex and receives completed files via rsync.

**Design principles:**
- Small file sizes (~1GB per movie). No 4K remux bloat.
- Wide discovery net: IMDB 5.9+, RT 60%+, plus cult classic and niche lists.
- Usenet (Giganews) as primary download path. Torrents via VyprVPN as backup.
- Everything on Hetzner runs in Docker containers managed by docker-compose.
- Home IP never touches trackers or indexers.

---

## Architecture

```
┌─────────────────────────── HETZNER CPX31 (Ashburn VA) ──────────────────────────┐
│                                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐                     │
│  │ Prowlarr │───│  Sonarr  │   │  Radarr  │   │  Lidarr  │                     │
│  │ (indexers)│   │   (TV)   │   │ (movies) │   │ (music)  │                     │
│  └──────────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘                     │
│                      │              │               │                            │
│                      └──────┬───────┘───────────────┘                            │
│                             │                                                    │
│               ┌─────────────┼─────────────┐                                     │
│               │             │             │                                      │
│          ┌────▼────┐  ┌─────▼─────┐  ┌────▼────┐                               │
│          │ SABnzbd │  │qBittorrent│  │  Bazarr │                               │
│          │ (usenet)│  │ (torrents)│  │ (subs)  │                               │
│          │Giganews │  │  VyprVPN  │  │         │                               │
│          └────┬────┘  └─────┬─────┘  └─────────┘                               │
│               │             │                                                    │
│               └──────┬──────┘                                                    │
│                      ▼                                                           │
│              /data/complete/    ← renamed, organized files ready for transfer    │
│                                                                                  │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                                   │
│  │ Overseerr │  │ Recyclarr │  │ Notifiarr │                                   │
│  │ (request  │  │ (quality  │  │ (push     │                                   │
│  │  UI)      │  │  profiles)│  │  alerts)  │                                   │
│  └───────────┘  └───────────┘  └───────────┘                                   │
│                                                                                  │
└──────────────────────────────────┬───────────────────────────────────────────────┘
                                   │
                          rsync over SSH
                          (every 30 min)
                                   │
                                   ▼
┌──────────────── HOME MBP 2019 ────────────────┐
│                                                 │
│   /Volumes/Media/Movies/                        │
│   /Volumes/Media/TV Shows/                      │
│   /Volumes/Media/Music/                         │
│                                                 │
│   ┌────────┐   ┌──────────┐                    │
│   │  Plex  │   │ Tautulli │                    │
│   │ Server │   │ (stats)  │                    │
│   └────────┘   └──────────┘                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Services

| Service | Port | Purpose |
|---------|------|---------|
| Prowlarr | 9696 | Indexer manager — connects Usenet + torrent indexers |
| Sonarr | 8989 | TV show automation — monitors, grabs, renames |
| Radarr | 7878 | Movie automation — monitors, grabs, renames |
| Lidarr | 8686 | Music automation |
| Bazarr | 6767 | Subtitle management (auto-downloads subs) |
| SABnzbd | 8080 | Usenet download client (Giganews) |
| qBittorrent | 8085 | Torrent client (through VyprVPN) |
| Overseerr | 5055 | Web UI for requesting content |
| Recyclarr | — | Runs on schedule, no web UI |
| Notifiarr | 5454 | Notification relay |
| Nginx Proxy | 80/443 | Reverse proxy + SSL for web UIs |

---

## Download Flow

1. **Discovery:** MDBList + curated lists feed Radarr/Sonarr with content matching rating thresholds
2. **Search:** Prowlarr searches configured indexers (Usenet providers via Giganews, torrent indexers)
3. **Download:** SABnzbd (Usenet, primary) or qBittorrent (torrents via VPN, backup)
4. **Post-processing:** Sonarr/Radarr rename files to Plex naming convention, move to `/data/complete/`
5. **Transfer:** rsync cron on home Mac pulls from Hetzner every 30 minutes
6. **Detection:** Plex auto-scans library folders, content appears in your library
7. **Notification:** Notifiarr sends push alert that new content is available

---

## File Naming Convention

Radarr/Sonarr handle this automatically. Target formats:

**Movies:** `Movie Title (Year)/Movie Title (Year) [quality].ext`
Example: `Stalker (1979)/Stalker (1979) [Bluray-720p].mkv`

**TV:** `Show Title/Season 01/Show Title - S01E01 - Episode Title [quality].ext`
Example: `The Wire/Season 01/The Wire - S01E01 - The Target [HDTV-720p].mkv`

**Music:** `Artist/Album (Year)/01 - Track Title.flac`

---

## Quality Profiles (Small Files)

Target: ~1GB per movie, ~500MB per TV episode. Prefer x265/HEVC encoding for best compression.

**Movie quality ranking (prefer top, accept any):**
1. Bluray-720p x265 (ideal — ~800MB-1.2GB)
2. WEBRip-720p / WEBDL-720p
3. Bluray-1080p x265 (acceptable if 720p unavailable — still ~1-2GB with x265)
4. HDTV-720p

**Size limits:** Radarr max 2GB per movie, Sonarr max 1GB per episode.

**Upgrade policy:** Only upgrade if the new file is meaningfully better quality AND still under size limit.

---

## Rating Thresholds & Auto-Discovery

**MDBList integration** provides dynamic lists filtered by rating:
- IMDB ≥ 5.9
- Rotten Tomatoes ≥ 60%
- Can add Metacritic, Letterboxd, etc.

**Curated lists to import:**
- MDBList: "Cult Classics"
- MDBList: "Hidden Gems"
- Letterboxd: Top 250 Narrative Features
- IMDb: Top 250
- Various "underseen" / "overlooked" lists
- Genre-specific lists (horror cult, arthouse, world cinema, etc.)

These get imported as Radarr/Sonarr lists — they auto-add content matching the criteria.

---

## Directory Structure on Hetzner

```
/opt/thea/                          ← project root
    docker-compose.yml
    .env                            ← API keys, passwords
    configs/                        ← persistent config for each service
        prowlarr/
        sonarr/
        radarr/
        lidarr/
        bazarr/
        sabnzbd/
        qbittorrent/
        overseerr/
        notifiarr/
    recyclarr/
        recyclarr.yml               ← TRaSH Guide sync config

/data/                              ← media data root
    usenet/                         ← SABnzbd working directory
        incomplete/
        complete/
    torrents/                       ← qBittorrent working directory
        incomplete/
        complete/
    media/                          ← organized, renamed files (rsync source)
        movies/
        tv/
        music/
```

---

## Transfer Mechanism (Hetzner → Home)

**rsync over SSH**, initiated from home Mac every 30 minutes via cron/launchd.

The home Mac already has `ssh filou` configured (passwordless). rsync pulls from `/data/media/` on Hetzner to the appropriate Plex library folders on the RAID array.

After successful transfer, files are deleted from Hetzner to free disk space (important — only 160GB SSD, shared with other apps).

---

## Storage Budget on Hetzner

Total: 160GB SSD
OS + existing apps (Spivco, Marilyn, Lucid Nidra, etc.): ~20GB
Docker images + configs: ~10GB
Available for download buffer: ~120-130GB

At ~1GB per movie, this is ~120 movies in the buffer. With rsync running every 30 min, the buffer should rarely fill up. Monitor with alerts if it hits 80%.

---

## Security

- All web UIs behind Nginx with HTTPS (Certbot SSL)
- Authentication on every service (no open dashboards)
- qBittorrent traffic routed through VyprVPN container (kill switch enabled)
- SABnzbd uses SSL connection to Giganews
- Overseerr can be exposed publicly for requests (has its own auth)
- SSH keys only (no password auth on Hetzner)

---

## Setup Order

1. Install Docker + Docker Compose on Hetzner
2. Create directory structure
3. Deploy docker-compose.yml
4. Configure Prowlarr (add indexers)
5. Configure SABnzbd (Giganews credentials)
6. Configure qBittorrent (VPN, download settings)
7. Configure Radarr (connect to Prowlarr + download clients, set quality profiles)
8. Configure Sonarr (same as Radarr)
9. Configure Lidarr (same pattern)
10. Configure Bazarr (connect to Sonarr/Radarr for subtitle matching)
11. Set up Recyclarr (TRaSH Guide quality sync)
12. Set up MDBList account + lists → import into Radarr/Sonarr
13. Set up Overseerr (connect to Radarr/Sonarr)
14. Set up Notifiarr (push notifications)
15. Set up rsync cron on home Mac
16. Import existing library into Radarr/Sonarr for rename + monitoring
17. Test full flow: request → download → rename → transfer → Plex

---

## Key Accounts Needed

- **MDBList** — free account at mdblist.com (for rating-filtered lists)
- **Usenet indexers** — at least 1-2 good indexers (NZBgeek, DrunkenSlug, etc.)
- **MyAnonaMouse** — private tracker (already noted in handoff)
- **Giganews** — already have (Usenet provider)
- **VyprVPN** — already have (via Giganews)

---

## Snap & Grab v2 — Movie Night Party App

Custom web app at port 3010. Phone-optimized, dark theme. Uses Gemini 2.5 Flash for all AI features.

**Solo Features (5 tabs at bottom):**
1. **What Am I Watching?** — Snap any screen/poster → Gemini identifies movie/show → checks Plex → one-tap download via Radarr/Sonarr
2. **Who's That?** — Snap an actor's face → identification + full filmography → each title checked against Plex → grab missing ones
3. **Trope Spotter** — Snap a scene → identifies cinematic tropes (Chekhov's Gun, Dutch Angle, etc.) with origin and examples
4. **Director's Eye** — Cinematography analysis: shot type, lighting, composition, color palette, technique, whose signature style it resembles

**Multiplayer Party Games (Party tab):**
- **Rooms** — Host creates a room (4-digit code + QR). Others scan QR or type code to join. WebSocket for real-time.
- **What Happens Next?** — Pause movie, snap screen. AI generates 5 choices (1 correct). Everyone picks. Reveal with scoring.
- **Movie Bingo** — AI generates unique 5x5 bingo cards per player based on genre/movie. Tap squares as tropes happen. First bingo wins.
- **Rate the Scene** — Everyone rates 1-10 anonymously. Reveal averages and outliers.
- **Drinking Game Mode** — AI generates custom rules by frequency (common/moderate/rare) for the current movie. Alcohol or snack mode.
- **Six Degrees** — Snap an actor, pick a target (default: Kevin Bacon). AI finds shortest connection chain.
- **Quote Catcher** — Snap subtitles → identify famous quotes, rate quotability, show cultural impact.
- **Prediction Market** — Pre-movie: AI generates prediction questions. Everyone answers. Score after movie ends.

**Permission system:** PIN-based. Admin (correct PIN) gets instant downloads. Guests queue requests for admin approval.

**Running scoreboard** tracks points across all games in a session.

**Stack:** Node.js + Express + WebSocket (ws) + Gemini 2.5 Flash. Docker container in the Thea stack.

---

## TODO

- [ ] Deploy docker-compose to Hetzner
- [ ] Configure all Arr services
- [ ] Set up MDBList + rating lists
- [ ] Set up rsync transfer to home Mac
- [ ] Import existing 20TB library into Radarr/Sonarr
- [ ] Test full pipeline end-to-end
- [ ] Set up monitoring/alerts for disk space
- [ ] Configure Snap & Grab .env (Gemini key, Arr API keys, Plex token)
- [ ] Test Snap & Grab with live Plex + Radarr
- [ ] Consider Hetzner volume add-on if buffer runs tight
