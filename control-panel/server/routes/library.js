import { Router } from 'express';
import fetch from 'node-fetch';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const RADARR = process.env.RADARR_URL || 'http://localhost:7878';
const SONARR = process.env.SONARR_URL || 'http://localhost:8989';
const RADARR_KEY = () => process.env.RADARR_API_KEY;
const SONARR_KEY = () => process.env.SONARR_API_KEY;

// ── Radarr Library (movies) ────────────────────────────────

router.get('/movies', async (req, res) => {
  try {
    const r = await fetch(`${RADARR}/api/v3/movie`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!r.ok) throw new Error(`Radarr ${r.status}`);
    const movies = await r.json();

    res.json(movies.map(m => ({
      id: m.id,
      tmdbId: m.tmdbId,
      title: m.title,
      year: m.year,
      monitored: m.monitored,
      hasFile: m.hasFile,
      sizeOnDisk: m.sizeOnDisk || 0,
      quality: m.movieFile?.quality?.quality?.name || null,
      added: m.added,
      path: m.path,
      poster: m.images?.find(i => i.coverType === 'poster')?.remoteUrl || null,
      status: m.status,
      // Download status
      isDownloading: false, // will be enriched by queue check
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Radarr library', detail: err.message });
  }
});

router.get('/shows', async (req, res) => {
  try {
    const r = await fetch(`${SONARR}/api/v3/series`, {
      headers: { 'X-Api-Key': SONARR_KEY() },
    });
    if (!r.ok) throw new Error(`Sonarr ${r.status}`);
    const shows = await r.json();

    res.json(shows.map(s => ({
      id: s.id,
      tvdbId: s.tvdbId,
      title: s.title,
      year: s.year,
      monitored: s.monitored,
      seasons: s.seasonCount,
      episodeCount: s.episodeCount,
      episodeFileCount: s.episodeFileCount,
      sizeOnDisk: s.sizeOnDisk || 0,
      added: s.added,
      path: s.path,
      poster: s.images?.find(i => i.coverType === 'poster')?.remoteUrl || null,
      status: s.status,
      network: s.network,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Sonarr library', detail: err.message });
  }
});

// ── Delete movie from Radarr (+ optionally delete files) ────

router.delete('/movies/:id', async (req, res) => {
  const { deleteFiles } = req.query;
  try {
    const r = await fetch(
      `${RADARR}/api/v3/movie/${req.params.id}?deleteFiles=${deleteFiles === 'true'}&addImportExclusion=false`,
      { method: 'DELETE', headers: { 'X-Api-Key': RADARR_KEY() } }
    );
    if (!r.ok) throw new Error(`Radarr delete ${r.status}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete movie', detail: err.message });
  }
});

router.delete('/shows/:id', async (req, res) => {
  const { deleteFiles } = req.query;
  try {
    const r = await fetch(
      `${SONARR}/api/v3/series/${req.params.id}?deleteFiles=${deleteFiles === 'true'}`,
      { method: 'DELETE', headers: { 'X-Api-Key': SONARR_KEY() } }
    );
    if (!r.ok) throw new Error(`Sonarr delete ${r.status}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete show', detail: err.message });
  }
});

// ── Toggle monitored status ─────────────────────────────────

router.patch('/movies/:id/monitor', async (req, res) => {
  try {
    // Get current movie data
    const getRes = await fetch(`${RADARR}/api/v3/movie/${req.params.id}`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!getRes.ok) throw new Error(`Get movie ${getRes.status}`);
    const movie = await getRes.json();

    // Toggle monitored
    movie.monitored = !movie.monitored;

    const putRes = await fetch(`${RADARR}/api/v3/movie/${req.params.id}`, {
      method: 'PUT',
      headers: { 'X-Api-Key': RADARR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify(movie),
    });
    if (!putRes.ok) throw new Error(`Update movie ${putRes.status}`);

    res.json({ ok: true, monitored: movie.monitored });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle monitor', detail: err.message });
  }
});

router.patch('/shows/:id/monitor', async (req, res) => {
  try {
    const getRes = await fetch(`${SONARR}/api/v3/series/${req.params.id}`, {
      headers: { 'X-Api-Key': SONARR_KEY() },
    });
    if (!getRes.ok) throw new Error(`Get show ${getRes.status}`);
    const show = await getRes.json();

    show.monitored = !show.monitored;

    const putRes = await fetch(`${SONARR}/api/v3/series/${req.params.id}`, {
      method: 'PUT',
      headers: { 'X-Api-Key': SONARR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify(show),
    });
    if (!putRes.ok) throw new Error(`Update show ${putRes.status}`);

    res.json({ ok: true, monitored: show.monitored });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle monitor', detail: err.message });
  }
});

// ── Search / re-search for a movie (trigger the agentic chain) ─

router.post('/movies/:id/search', async (req, res) => {
  try {
    const r = await fetch(`${RADARR}/api/v3/command`, {
      method: 'POST',
      headers: { 'X-Api-Key': RADARR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'MoviesSearch', movieIds: [parseInt(req.params.id)] }),
    });
    if (!r.ok) throw new Error(`Search command ${r.status}`);
    res.json({ ok: true, message: 'Search triggered — Radarr will find the best release' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger search', detail: err.message });
  }
});

router.post('/shows/:id/search', async (req, res) => {
  try {
    const r = await fetch(`${SONARR}/api/v3/command`, {
      method: 'POST',
      headers: { 'X-Api-Key': SONARR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SeriesSearch', seriesId: parseInt(req.params.id) }),
    });
    if (!r.ok) throw new Error(`Search command ${r.status}`);
    res.json({ ok: true, message: 'Search triggered — Sonarr will find the best release' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger search', detail: err.message });
  }
});

// ── Library stats ───────────────────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    const [moviesRes, showsRes] = await Promise.all([
      fetch(`${RADARR}/api/v3/movie`, { headers: { 'X-Api-Key': RADARR_KEY() } }),
      fetch(`${SONARR}/api/v3/series`, { headers: { 'X-Api-Key': SONARR_KEY() } }),
    ]);

    const movies = moviesRes.ok ? await moviesRes.json() : [];
    const shows = showsRes.ok ? await showsRes.json() : [];

    const totalMovieSize = movies.reduce((sum, m) => sum + (m.sizeOnDisk || 0), 0);
    const totalShowSize = shows.reduce((sum, s) => sum + (s.sizeOnDisk || 0), 0);

    res.json({
      movies: {
        total: movies.length,
        downloaded: movies.filter(m => m.hasFile).length,
        missing: movies.filter(m => m.monitored && !m.hasFile).length,
        unmonitored: movies.filter(m => !m.monitored).length,
        sizeOnDisk: totalMovieSize,
      },
      shows: {
        total: shows.length,
        continuing: shows.filter(s => s.status === 'continuing').length,
        ended: shows.filter(s => s.status === 'ended').length,
        sizeOnDisk: totalShowSize,
      },
      totalSizeOnDisk: totalMovieSize + totalShowSize,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get library stats', detail: err.message });
  }
});

// ── Search ALL missing movies (trigger batch download) ──────

router.post('/movies/search-missing', async (req, res) => {
  try {
    const r = await fetch(`${RADARR}/api/v3/command`, {
      method: 'POST',
      headers: { 'X-Api-Key': RADARR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'MissingMoviesSearch' }),
    });
    if (!r.ok) throw new Error(`Command failed ${r.status}`);
    res.json({ ok: true, message: 'Searching for all missing movies — Radarr will find the best releases' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger missing movie search', detail: err.message });
  }
});

// ── Search ALL missing TV episodes ──────────────────────────

router.post('/shows/search-missing', async (req, res) => {
  try {
    const r = await fetch(`${SONARR}/api/v3/command`, {
      method: 'POST',
      headers: { 'X-Api-Key': SONARR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'MissingEpisodeSearch' }),
    });
    if (!r.ok) throw new Error(`Command failed ${r.status}`);
    res.json({ ok: true, message: 'Searching for all missing episodes — Sonarr will find the best releases' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger missing episode search', detail: err.message });
  }
});

// ── Fix download client priorities (SABnzbd=1, qBittorrent=2) ─

router.post('/fix-priorities', async (req, res) => {
  try {
    // Get all download clients from Radarr
    const radarrRes = await fetch(`${RADARR}/api/v3/downloadclient`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!radarrRes.ok) throw new Error(`Radarr clients ${radarrRes.status}`);
    const radarrClients = await radarrRes.json();

    // Get all download clients from Sonarr
    const sonarrRes = await fetch(`${SONARR}/api/v3/downloadclient`, {
      headers: { 'X-Api-Key': SONARR_KEY() },
    });
    if (!sonarrRes.ok) throw new Error(`Sonarr clients ${sonarrRes.status}`);
    const sonarrClients = await sonarrRes.json();

    const fixClient = async (client, baseUrl, apiKey) => {
      const isSab = client.implementation === 'Sabnzbd';
      const isQbit = client.implementation === 'QBittorrent';
      const targetPriority = isSab ? 1 : isQbit ? 2 : client.priority;

      if (client.priority !== targetPriority) {
        client.priority = targetPriority;
        await fetch(`${baseUrl}/api/v3/downloadclient/${client.id}`, {
          method: 'PUT',
          headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(client),
        });
        return true;
      }
      return false;
    };

    let fixed = 0;
    for (const c of radarrClients) {
      if (await fixClient(c, RADARR, RADARR_KEY())) fixed++;
    }
    for (const c of sonarrClients) {
      if (await fixClient(c, SONARR, SONARR_KEY())) fixed++;
    }

    res.json({ ok: true, message: `Fixed ${fixed} download client priorities`, fixed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fix priorities', detail: err.message });
  }
});

export default router;
