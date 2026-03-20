import { Router } from 'express';
import fetch from 'node-fetch';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const RADARR = process.env.RADARR_URL || 'http://localhost:7878';
const SONARR = process.env.SONARR_URL || 'http://localhost:8989';
const RADARR_KEY = () => process.env.RADARR_API_KEY;
const SONARR_KEY = () => process.env.SONARR_API_KEY;
const MDBLIST_KEY = () => process.env.MDBLIST_API_KEY;

// ── MDBList: Get user's lists ───────────────────────────────

router.get('/mdblist/lists', async (req, res) => {
  const apiKey = MDBLIST_KEY();
  if (!apiKey) {
    return res.status(400).json({ error: 'MDBList API key not configured. Add MDBLIST_API_KEY to .env' });
  }

  try {
    const r = await fetch(`https://mdblist.com/api/lists/user?apikey=${apiKey}`);
    if (!r.ok) throw new Error(`MDBList ${r.status}`);
    const lists = await r.json();
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch MDBList lists', detail: err.message });
  }
});

// ── MDBList: Get items in a specific list ───────────────────

router.get('/mdblist/lists/:id', async (req, res) => {
  const apiKey = MDBLIST_KEY();
  if (!apiKey) {
    return res.status(400).json({ error: 'MDBList API key not configured' });
  }

  try {
    const r = await fetch(`https://mdblist.com/api/lists/${req.params.id}/items?apikey=${apiKey}`);
    if (!r.ok) throw new Error(`MDBList ${r.status}`);
    const items = await r.json();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch list items', detail: err.message });
  }
});

// ── MDBList: Search for public lists ────────────────────────

router.get('/mdblist/search', async (req, res) => {
  const { q } = req.query;
  const apiKey = MDBLIST_KEY();
  if (!apiKey) {
    return res.status(400).json({ error: 'MDBList API key not configured' });
  }

  try {
    // MDBList doesn't have a search API, but we can use the top lists
    const r = await fetch(`https://mdblist.com/api/lists/top?apikey=${apiKey}`);
    if (!r.ok) throw new Error(`MDBList ${r.status}`);
    const lists = await r.json();

    // Filter by query if provided
    const filtered = q
      ? lists.filter(l => l.name?.toLowerCase().includes(q.toLowerCase()))
      : lists;

    res.json(filtered.slice(0, 50));
  } catch (err) {
    res.status(500).json({ error: 'Failed to search lists', detail: err.message });
  }
});

// ── Radarr Import Lists (what's currently auto-importing) ───

router.get('/radarr/lists', async (req, res) => {
  try {
    const r = await fetch(`${RADARR}/api/v3/importlist`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!r.ok) throw new Error(`Radarr lists ${r.status}`);
    const lists = await r.json();
    res.json(lists.map(l => ({
      id: l.id,
      name: l.name,
      enabled: l.enabled,
      enableAuto: l.enableAuto,
      listType: l.listType,
      implementation: l.implementation,
      qualityProfileId: l.qualityProfileId,
      rootFolderPath: l.rootFolderPath,
      shouldMonitor: l.shouldMonitor,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Radarr import lists', detail: err.message });
  }
});

// ── Sonarr Import Lists ─────────────────────────────────────

router.get('/sonarr/lists', async (req, res) => {
  try {
    const r = await fetch(`${SONARR}/api/v3/importlist`, {
      headers: { 'X-Api-Key': SONARR_KEY() },
    });
    if (!r.ok) throw new Error(`Sonarr lists ${r.status}`);
    const lists = await r.json();
    res.json(lists.map(l => ({
      id: l.id,
      name: l.name,
      enabled: l.enabled,
      enableAuto: l.enableAuto,
      listType: l.listType,
      implementation: l.implementation,
      qualityProfileId: l.qualityProfileId,
      rootFolderPath: l.rootFolderPath,
      shouldMonitor: l.shouldMonitor,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Sonarr import lists', detail: err.message });
  }
});

// ── Quality Profiles ────────────────────────────────────────

router.get('/radarr/profiles', async (req, res) => {
  try {
    const r = await fetch(`${RADARR}/api/v3/qualityprofile`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!r.ok) throw new Error(`Radarr profiles ${r.status}`);
    const profiles = await r.json();
    res.json(profiles.map(p => ({
      id: p.id,
      name: p.name,
      upgradeAllowed: p.upgradeAllowed,
      cutoff: p.cutoff,
      items: p.items?.filter(i => i.allowed).map(i => i.quality?.name || i.name) || [],
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quality profiles', detail: err.message });
  }
});

router.get('/sonarr/profiles', async (req, res) => {
  try {
    const r = await fetch(`${SONARR}/api/v3/qualityprofile`, {
      headers: { 'X-Api-Key': SONARR_KEY() },
    });
    if (!r.ok) throw new Error(`Sonarr profiles ${r.status}`);
    const profiles = await r.json();
    res.json(profiles.map(p => ({
      id: p.id,
      name: p.name,
      upgradeAllowed: p.upgradeAllowed,
      cutoff: p.cutoff,
      items: p.items?.filter(i => i.allowed).map(i => i.quality?.name || i.name) || [],
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quality profiles', detail: err.message });
  }
});

// ── Blocklist (releases that failed) ────────────────────────

router.get('/radarr/blocklist', async (req, res) => {
  try {
    const r = await fetch(`${RADARR}/api/v3/blocklist?pageSize=25&sortDirection=descending&sortKey=date`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!r.ok) throw new Error(`Radarr blocklist ${r.status}`);
    const data = await r.json();
    res.json((data.records || []).map(b => ({
      id: b.id,
      title: b.movie?.title || b.sourceTitle,
      sourceTitle: b.sourceTitle,
      quality: b.quality?.quality?.name,
      date: b.date,
      protocol: b.protocol,
      message: b.message,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch blocklist', detail: err.message });
  }
});

// ── Clear a blocklist entry ─────────────────────────────────

router.delete('/radarr/blocklist/:id', async (req, res) => {
  try {
    const r = await fetch(`${RADARR}/api/v3/blocklist/${req.params.id}`, {
      method: 'DELETE',
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!r.ok) throw new Error(`Clear blocklist ${r.status}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear blocklist entry', detail: err.message });
  }
});

// ── Trigger full library refresh ────────────────────────────

router.post('/radarr/refresh', async (req, res) => {
  try {
    await fetch(`${RADARR}/api/v3/command`, {
      method: 'POST',
      headers: { 'X-Api-Key': RADARR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'RefreshMovie' }),
    });
    res.json({ ok: true, message: 'Radarr library refresh started' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to refresh Radarr' });
  }
});

router.post('/sonarr/refresh', async (req, res) => {
  try {
    await fetch(`${SONARR}/api/v3/command`, {
      method: 'POST',
      headers: { 'X-Api-Key': SONARR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'RefreshSeries' }),
    });
    res.json({ ok: true, message: 'Sonarr library refresh started' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to refresh Sonarr' });
  }
});

export default router;
