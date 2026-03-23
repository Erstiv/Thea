import { Router } from 'express';
import fetch from 'node-fetch';
import { execSync } from 'child_process';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// ── System Health ───────────────────────────────────────────

router.get('/health', async (req, res) => {
  try {
    const health = {};

    // Disk space
    try {
      const dfOutput = execSync("df -h / | tail -1 | awk '{print $2, $3, $4, $5}'").toString().trim();
      const [total, used, available, usePercent] = dfOutput.split(' ');
      health.disk = { total, used, available, usePercent };
    } catch { health.disk = { error: 'Could not read disk info' }; }

    // Media disk usage
    try {
      const mediaOutput = execSync("du -sh /data/media/ 2>/dev/null || echo 'N/A'").toString().trim();
      health.mediaSize = mediaOutput.split('\t')[0];
    } catch { health.mediaSize = 'N/A'; }

    // Memory
    try {
      const memOutput = execSync("free -h | grep Mem | awk '{print $2, $3, $4}'").toString().trim();
      const [total, used, free] = memOutput.split(' ');
      health.memory = { total, used, free };
    } catch { health.memory = { error: 'Could not read memory' }; }

    // Uptime
    try {
      health.uptime = execSync('uptime -p').toString().trim();
    } catch { health.uptime = 'N/A'; }

    // Docker containers
    try {
      const dockerOutput = execSync(
        "docker ps --format '{{.Names}}|{{.Status}}|{{.Ports}}' 2>/dev/null"
      ).toString().trim();
      health.containers = dockerOutput.split('\n').filter(Boolean).map(line => {
        const [name, status, ports] = line.split('|');
        return { name, status, ports };
      });
    } catch { health.containers = []; }

    // VPN status (check if gluetun is healthy)
    try {
      const vpnCheck = execSync(
        "docker exec gluetun wget -qO- https://ipinfo.io/ip 2>/dev/null || echo 'unknown'"
      ).toString().trim();
      health.vpn = { externalIp: vpnCheck, active: vpnCheck !== 'unknown' && vpnCheck !== '' };
    } catch { health.vpn = { externalIp: 'unknown', active: false }; }

    res.json(health);
  } catch (err) {
    res.status(500).json({ error: 'Health check failed', detail: err.message });
  }
});

// ── Downloads ───────────────────────────────────────────────

router.get('/downloads', async (req, res) => {
  try {
    const downloads = { queue: [], history: [] };

    // qBittorrent active downloads
    try {
      const qbtRes = await fetch('http://localhost:8085/api/v2/torrents/info?filter=downloading', {
        headers: { Cookie: await getQbtCookie() },
      });
      if (qbtRes.ok) {
        const torrents = await qbtRes.json();
        downloads.queue.push(...torrents.map(t => ({
          name: t.name,
          progress: Math.round(t.progress * 100),
          size: formatBytes(t.total_size),
          speed: formatBytes(t.dlspeed) + '/s',
          eta: t.eta > 0 ? formatEta(t.eta) : 'N/A',
          source: 'torrent',
        })));
      }
    } catch {}

    // SABnzbd active downloads
    try {
      const sabRes = await fetch(
        `http://localhost:8080/api?mode=queue&output=json&apikey=${process.env.SABNZBD_API_KEY || '5ed5e9c7119e410c88fcc72db9619c1f'}`
      );
      if (sabRes.ok) {
        const sabData = await sabRes.json();
        const slots = sabData.queue?.slots || [];
        downloads.queue.push(...slots.map(s => ({
          name: s.filename,
          progress: Math.round(parseFloat(s.percentage)),
          size: s.size,
          speed: sabData.queue?.speed || 'N/A',
          eta: s.timeleft || 'N/A',
          source: 'usenet',
        })));
      }
    } catch {}

    // Recent completed (from Radarr history)
    try {
      const radarrRes = await fetch(
        `http://localhost:7878/api/v3/history?pageSize=10&sortDirection=descending&sortKey=date&apikey=${process.env.RADARR_API_KEY}`
      );
      if (radarrRes.ok) {
        const data = await radarrRes.json();
        downloads.history = (data.records || []).slice(0, 10).map(r => ({
          title: r.movie?.title || r.sourceTitle,
          date: r.date,
          quality: r.quality?.quality?.name || 'Unknown',
          eventType: r.eventType,
        }));
      }
    } catch {}

    res.json(downloads);
  } catch (err) {
    res.status(500).json({ error: 'Downloads check failed', detail: err.message });
  }
});

// ── Users ───────────────────────────────────────────────────

router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT id, email, display_name, avatar_url, role, auth_provider, created_at, last_login
    FROM users ORDER BY created_at DESC
  `).all();
  res.json(users);
});

router.delete('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  if (userId === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.json({ ok: true });
});

router.patch('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, parseInt(req.params.id));
  res.json({ ok: true });
});

// ── Arr Service Status ──────────────────────────────────────

router.get('/services', async (req, res) => {
  const services = [
    { name: 'Radarr', url: process.env.RADARR_URL, apiKey: process.env.RADARR_API_KEY, path: '/api/v3/system/status' },
    { name: 'Sonarr', url: process.env.SONARR_URL, apiKey: process.env.SONARR_API_KEY, path: '/api/v3/system/status' },
    { name: 'Overseerr', url: process.env.OVERSEERR_URL, path: '/api/v1/status' },
  ];

  const results = await Promise.all(services.map(async svc => {
    try {
      const headers = svc.apiKey ? { 'X-Api-Key': svc.apiKey } : {};
      const r = await fetch(`${svc.url}${svc.path}`, { headers, signal: AbortSignal.timeout(5000) });
      return { name: svc.name, status: r.ok ? 'online' : 'error', code: r.status };
    } catch {
      return { name: svc.name, status: 'offline' };
    }
  }));

  res.json(results);
});

// ── Helpers ─────────────────────────────────────────────────

let qbtCookie = null;
async function getQbtCookie() {
  if (qbtCookie) return qbtCookie;
  try {
    const res = await fetch('http://localhost:8085/api/v2/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=admin&password=Megahertz1!',
    });
    qbtCookie = res.headers.get('set-cookie')?.split(';')[0] || '';
    return qbtCookie;
  } catch { return ''; }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatEta(seconds) {
  if (seconds <= 0) return 'N/A';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── All requests (admin view) — enriched with live Radarr/Plex status ──

router.get('/requests', async (req, res) => {
  const requests = db.prepare(`
    SELECT r.*, u.display_name as user_name
    FROM requests r
    LEFT JOIN users u ON r.user_id = u.id
    ORDER BY r.created_at DESC
    LIMIT 100
  `).all();

  // Enrich each request with live download/library status
  const radarrUrl = process.env.RADARR_URL || 'http://localhost:7878';
  const radarrKey = process.env.RADARR_API_KEY;
  const plexUrl = process.env.PLEX_SERVER_URL;
  const plexToken = process.env.PLEX_TOKEN;

  // Fetch Radarr queue once for all requests
  let radarrQueue = [];
  try {
    const qr = await fetch(`${radarrUrl}/api/v3/queue?includeMovie=true&pageSize=200`, {
      headers: { 'X-Api-Key': radarrKey },
    });
    if (qr.ok) {
      const qdata = await qr.json();
      radarrQueue = qdata.records || [];
    }
  } catch {}

  const enriched = await Promise.all(requests.map(async (r) => {
    const enrichment = { liveStatus: r.status, progress: null, quality: null, size: null, eta: null, inPlex: false, protocol: null };

    if (r.media_type === 'tv') return { ...r, ...enrichment };

    try {
      // Check Radarr for this movie
      const mr = await fetch(`${radarrUrl}/api/v3/movie?tmdbId=${r.tmdb_id}`, {
        headers: { 'X-Api-Key': radarrKey },
      });
      if (mr.ok) {
        const movies = await mr.json();
        if (movies.length > 0) {
          const movie = movies[0];
          if (movie.hasFile) {
            enrichment.liveStatus = 'downloaded';
            enrichment.quality = movie.movieFile?.quality?.quality?.name;
            enrichment.size = movie.movieFile?.size;
          } else if (movie.monitored) {
            // Check if it's in the download queue
            const qi = radarrQueue.find(q => q.movie?.tmdbId === r.tmdb_id);
            if (qi) {
              enrichment.liveStatus = 'downloading';
              enrichment.progress = qi.size > 0 ? Math.round(((qi.size - qi.sizeleft) / qi.size) * 100) : 0;
              enrichment.quality = qi.quality?.quality?.name;
              enrichment.size = qi.size;
              enrichment.eta = qi.estimatedCompletionTime;
              enrichment.protocol = qi.protocol;
            } else {
              enrichment.liveStatus = movie.status === 'inCinemas' ? 'in_cinemas' : 'searching';
            }
          } else {
            enrichment.liveStatus = 'unmonitored';
          }
        }
      }
    } catch {}

    // Check Plex
    try {
      if (plexUrl && plexToken) {
        const pr = await fetch(`${plexUrl}/hubs/search?query=${encodeURIComponent(r.title)}&limit=5&X-Plex-Token=${plexToken}`, {
          headers: { Accept: 'application/json' },
        });
        if (pr.ok) {
          const pd = await pr.json();
          for (const hub of pd.MediaContainer?.Hub || []) {
            for (const item of hub.Metadata || []) {
              if (item.title?.toLowerCase() === r.title?.toLowerCase()) {
                enrichment.inPlex = true;
                enrichment.plexRatingKey = item.ratingKey;
                if (enrichment.liveStatus === 'downloaded') {
                  enrichment.liveStatus = 'ready';
                }
                break;
              }
            }
            if (enrichment.inPlex) break;
          }
        }
      }
    } catch {}

    return { ...r, ...enrichment };
  }));

  res.json(enriched);
});

// ── Delete a request (admin) + remove from Radarr/Sonarr ────

router.delete('/requests/:id', async (req, res) => {
  const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  try {
    // Try to remove from Radarr/Sonarr too
    if (request.media_type === 'movie' || request.media_type !== 'tv') {
      try {
        const radarrUrl = process.env.RADARR_URL || 'http://localhost:7878';
        const r = await fetch(`${radarrUrl}/api/v3/movie?tmdbId=${request.tmdb_id}`, {
          headers: { 'X-Api-Key': process.env.RADARR_API_KEY },
        });
        if (r.ok) {
          const movies = await r.json();
          for (const movie of movies) {
            // Only delete if it doesn't have files (don't delete downloaded content)
            if (!movie.hasFile) {
              await fetch(`${radarrUrl}/api/v3/movie/${movie.id}?deleteFiles=false&addImportExclusion=false`, {
                method: 'DELETE', headers: { 'X-Api-Key': process.env.RADARR_API_KEY },
              });
            }
          }
        }
      } catch {}
    }

    if (request.media_type === 'tv') {
      try {
        const sonarrUrl = process.env.SONARR_URL || 'http://localhost:8989';
        const r = await fetch(`${sonarrUrl}/api/v3/series?tvdbId=${request.tmdb_id}`, {
          headers: { 'X-Api-Key': process.env.SONARR_API_KEY },
        });
        if (r.ok) {
          const shows = await r.json();
          for (const show of shows) {
            await fetch(`${sonarrUrl}/api/v3/series/${show.id}?deleteFiles=false`, {
              method: 'DELETE', headers: { 'X-Api-Key': process.env.SONARR_API_KEY },
            });
          }
        }
      } catch {}
    }

    // Delete from local DB
    db.prepare('DELETE FROM requests WHERE id = ?').run(req.params.id);
    res.json({ ok: true, message: `Deleted request for "${request.title}"` });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed', detail: err.message });
  }
});

export default router;
