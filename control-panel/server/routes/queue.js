import { Router } from 'express';
import fetch from 'node-fetch';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const RADARR = process.env.RADARR_URL || 'http://localhost:7878';
const SONARR = process.env.SONARR_URL || 'http://localhost:8989';
const RADARR_KEY = () => process.env.RADARR_API_KEY;
const SONARR_KEY = () => process.env.SONARR_API_KEY;
const SABNZBD_URL = 'http://localhost:8080';
const SABNZBD_KEY = () => process.env.SABNZBD_API_KEY || '5ed5e9c7119e410c88fcc72db9619c1f';

// ── Full download queue (Radarr + Sonarr queues) ────────────

router.get('/', async (req, res) => {
  try {
    const [radarrQueue, sonarrQueue] = await Promise.all([
      fetchRadarrQueue(),
      fetchSonarrQueue(),
    ]);

    const queue = [
      ...radarrQueue.map(q => ({ ...q, manager: 'radarr' })),
      ...sonarrQueue.map(q => ({ ...q, manager: 'sonarr' })),
    ].sort((a, b) => new Date(b.added) - new Date(a.added));

    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch queue', detail: err.message });
  }
});

// ── Remove item from queue ──────────────────────────────────

router.delete('/radarr/:id', async (req, res) => {
  const { blocklist } = req.query;
  try {
    const r = await fetch(
      `${RADARR}/api/v3/queue/${req.params.id}?removeFromClient=true&blocklist=${blocklist === 'true'}`,
      { method: 'DELETE', headers: { 'X-Api-Key': RADARR_KEY() } }
    );
    if (!r.ok) throw new Error(`Remove from Radarr queue: ${r.status}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from queue', detail: err.message });
  }
});

router.delete('/sonarr/:id', async (req, res) => {
  const { blocklist } = req.query;
  try {
    const r = await fetch(
      `${SONARR}/api/v3/queue/${req.params.id}?removeFromClient=true&blocklist=${blocklist === 'true'}`,
      { method: 'DELETE', headers: { 'X-Api-Key': SONARR_KEY() } }
    );
    if (!r.ok) throw new Error(`Remove from Sonarr queue: ${r.status}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from queue', detail: err.message });
  }
});

// ── Force re-grab (blocklist current + search again) ────────

router.post('/radarr/:id/retry', async (req, res) => {
  try {
    // Get queue item to find the movie ID
    const queueRes = await fetch(`${RADARR}/api/v3/queue?includeMovie=true`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    const queueData = await queueRes.json();
    const item = (queueData.records || []).find(r => r.id === parseInt(req.params.id));

    if (!item) throw new Error('Queue item not found');

    // Remove + blocklist the bad release
    await fetch(
      `${RADARR}/api/v3/queue/${req.params.id}?removeFromClient=true&blocklist=true`,
      { method: 'DELETE', headers: { 'X-Api-Key': RADARR_KEY() } }
    );

    // Trigger a new search for the movie
    if (item.movieId) {
      await fetch(`${RADARR}/api/v3/command`, {
        method: 'POST',
        headers: { 'X-Api-Key': RADARR_KEY(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'MoviesSearch', movieIds: [item.movieId] }),
      });
    }

    res.json({ ok: true, message: 'Bad release blocklisted, searching for alternative...' });
  } catch (err) {
    res.status(500).json({ error: 'Retry failed', detail: err.message });
  }
});

router.post('/sonarr/:id/retry', async (req, res) => {
  try {
    const queueRes = await fetch(`${SONARR}/api/v3/queue?includeSeries=true&includeEpisode=true`, {
      headers: { 'X-Api-Key': SONARR_KEY() },
    });
    const queueData = await queueRes.json();
    const item = (queueData.records || []).find(r => r.id === parseInt(req.params.id));

    if (!item) throw new Error('Queue item not found');

    await fetch(
      `${SONARR}/api/v3/queue/${req.params.id}?removeFromClient=true&blocklist=true`,
      { method: 'DELETE', headers: { 'X-Api-Key': SONARR_KEY() } }
    );

    if (item.seriesId) {
      await fetch(`${SONARR}/api/v3/command`, {
        method: 'POST',
        headers: { 'X-Api-Key': SONARR_KEY(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'SeriesSearch', seriesId: item.seriesId }),
      });
    }

    res.json({ ok: true, message: 'Bad release blocklisted, searching for alternative...' });
  } catch (err) {
    res.status(500).json({ error: 'Retry failed', detail: err.message });
  }
});

// ── SABnzbd direct controls ────────────────────────────────

router.post('/sabnzbd/pause', async (req, res) => {
  try {
    await fetch(`${SABNZBD_URL}/api?mode=pause&apikey=${SABNZBD_KEY()}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pause SABnzbd' });
  }
});

router.post('/sabnzbd/resume', async (req, res) => {
  try {
    await fetch(`${SABNZBD_URL}/api?mode=resume&apikey=${SABNZBD_KEY()}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resume SABnzbd' });
  }
});

// ── Helpers ─────────────────────────────────────────────────

async function fetchRadarrQueue() {
  try {
    const r = await fetch(`${RADARR}/api/v3/queue?includeMovie=true&pageSize=50`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.records || []).map(q => ({
      id: q.id,
      title: q.movie?.title || q.title || 'Unknown',
      quality: q.quality?.quality?.name || 'Unknown',
      size: q.size || 0,
      sizeleft: q.sizeleft || 0,
      progress: q.size > 0 ? Math.round(((q.size - q.sizeleft) / q.size) * 100) : 0,
      status: q.status,
      trackedDownloadStatus: q.trackedDownloadStatus,
      trackedDownloadState: q.trackedDownloadState,
      statusMessages: q.statusMessages || [],
      protocol: q.protocol, // 'usenet' or 'torrent'
      downloadClient: q.downloadClient,
      added: q.added,
      estimatedCompletionTime: q.estimatedCompletionTime,
      movieId: q.movieId,
    }));
  } catch { return []; }
}

async function fetchSonarrQueue() {
  try {
    const r = await fetch(`${SONARR}/api/v3/queue?includeSeries=true&includeEpisode=true&pageSize=50`, {
      headers: { 'X-Api-Key': SONARR_KEY() },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.records || []).map(q => ({
      id: q.id,
      title: q.series?.title
        ? `${q.series.title} - ${q.episode?.title || `S${String(q.episode?.seasonNumber).padStart(2,'0')}E${String(q.episode?.episodeNumber).padStart(2,'0')}`}`
        : q.title || 'Unknown',
      quality: q.quality?.quality?.name || 'Unknown',
      size: q.size || 0,
      sizeleft: q.sizeleft || 0,
      progress: q.size > 0 ? Math.round(((q.size - q.sizeleft) / q.size) * 100) : 0,
      status: q.status,
      trackedDownloadStatus: q.trackedDownloadStatus,
      trackedDownloadState: q.trackedDownloadState,
      statusMessages: q.statusMessages || [],
      protocol: q.protocol,
      downloadClient: q.downloadClient,
      added: q.added,
      estimatedCompletionTime: q.estimatedCompletionTime,
      seriesId: q.seriesId,
    }));
  } catch { return []; }
}

export default router;
