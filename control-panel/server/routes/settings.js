import { Router } from 'express';
import fetch from 'node-fetch';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const RADARR = process.env.RADARR_URL || 'http://localhost:7878';
const SONARR = process.env.SONARR_URL || 'http://localhost:8989';
const OVERSEERR = process.env.OVERSEERR_URL || 'http://localhost:5055';
const RADARR_KEY = () => process.env.RADARR_API_KEY;
const SONARR_KEY = () => process.env.SONARR_API_KEY;
const OVERSEERR_KEY = () => process.env.OVERSEERR_API_KEY;

// ══════════════════════════════════════════════════════════════
// OVERSEERR USER PERMISSIONS
// ══════════════════════════════════════════════════════════════

// Get all Overseerr users with their permission levels
router.get('/overseerr/users', async (req, res) => {
  try {
    const r = await fetch(`${OVERSEERR}/api/v1/user?take=50`, {
      headers: { 'X-Api-Key': OVERSEERR_KEY() },
    });
    if (!r.ok) throw new Error(`Overseerr users ${r.status}`);
    const data = await r.json();

    res.json((data.results || []).map(u => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      avatar: u.avatar,
      requestCount: u.requestCount,
      permissions: u.permissions,
      // Decode key permission flags
      autoApprove: (u.permissions & 128) !== 0,        // AUTO_APPROVE
      autoApproveMovies: (u.permissions & 256) !== 0,   // AUTO_APPROVE_MOVIE
      autoApproveTv: (u.permissions & 512) !== 0,       // AUTO_APPROVE_TV
      canRequest: (u.permissions & 4) !== 0,            // REQUEST
      isAdmin: (u.permissions & 2) !== 0,               // ADMIN
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Overseerr users', detail: err.message });
  }
});

// Toggle a permission flag on a user
router.patch('/overseerr/users/:id/permissions', async (req, res) => {
  const { flag, enabled } = req.body;

  // Permission flag map
  const FLAGS = {
    admin: 2,
    request: 4,
    autoApprove: 128,
    autoApproveMovies: 256,
    autoApproveTv: 512,
    manageRequests: 16,
    manageUsers: 32,
  };

  const flagBit = FLAGS[flag];
  if (!flagBit) return res.status(400).json({ error: `Unknown flag: ${flag}. Valid: ${Object.keys(FLAGS).join(', ')}` });

  try {
    // Get current user
    const getRes = await fetch(`${OVERSEERR}/api/v1/user/${req.params.id}`, {
      headers: { 'X-Api-Key': OVERSEERR_KEY() },
    });
    if (!getRes.ok) throw new Error(`Get user ${getRes.status}`);
    const user = await getRes.json();

    // Toggle the bit
    let newPermissions = user.permissions;
    if (enabled) {
      newPermissions = newPermissions | flagBit;
    } else {
      newPermissions = newPermissions & ~flagBit;
    }

    // Update
    const putRes = await fetch(`${OVERSEERR}/api/v1/user/${req.params.id}`, {
      method: 'PUT',
      headers: { 'X-Api-Key': OVERSEERR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, permissions: newPermissions }),
    });
    if (!putRes.ok) throw new Error(`Update user ${putRes.status}`);

    res.json({ ok: true, permissions: newPermissions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update permissions', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// QUALITY PROFILES — READ & EDIT
// ══════════════════════════════════════════════════════════════

// Get full quality profile details (for editing)
router.get('/radarr/profiles', async (req, res) => {
  try {
    const r = await fetch(`${RADARR}/api/v3/qualityprofile`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!r.ok) throw new Error(`Radarr profiles ${r.status}`);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Radarr profiles', detail: err.message });
  }
});

router.get('/sonarr/profiles', async (req, res) => {
  try {
    const r = await fetch(`${SONARR}/api/v3/qualityprofile`, {
      headers: { 'X-Api-Key': SONARR_KEY() },
    });
    if (!r.ok) throw new Error(`Sonarr profiles ${r.status}`);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Sonarr profiles', detail: err.message });
  }
});

// Update a quality profile
router.put('/radarr/profiles/:id', async (req, res) => {
  try {
    const r = await fetch(`${RADARR}/api/v3/qualityprofile/${req.params.id}`, {
      method: 'PUT',
      headers: { 'X-Api-Key': RADARR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    if (!r.ok) throw new Error(`Update Radarr profile ${r.status}`);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile', detail: err.message });
  }
});

router.put('/sonarr/profiles/:id', async (req, res) => {
  try {
    const r = await fetch(`${SONARR}/api/v3/qualityprofile/${req.params.id}`, {
      method: 'PUT',
      headers: { 'X-Api-Key': SONARR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    if (!r.ok) throw new Error(`Update Sonarr profile ${r.status}`);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// IMPORT LISTS — ADD, REMOVE, TOGGLE
// ══════════════════════════════════════════════════════════════

// Get Radarr import lists (full detail)
router.get('/radarr/lists', async (req, res) => {
  try {
    const r = await fetch(`${RADARR}/api/v3/importlist`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!r.ok) throw new Error(`Radarr lists ${r.status}`);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lists', detail: err.message });
  }
});

// Get root folders (needed when adding lists)
router.get('/radarr/rootfolders', async (req, res) => {
  try {
    const r = await fetch(`${RADARR}/api/v3/rootfolder`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!r.ok) throw new Error(`Radarr rootfolders ${r.status}`);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch root folders', detail: err.message });
  }
});

// Toggle an import list on/off
router.patch('/radarr/lists/:id/toggle', async (req, res) => {
  try {
    const getRes = await fetch(`${RADARR}/api/v3/importlist/${req.params.id}`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!getRes.ok) throw new Error(`Get list ${getRes.status}`);
    const list = await getRes.json();

    list.enabled = !list.enabled;
    list.enableAuto = list.enabled; // Auto-add follows enabled state

    const putRes = await fetch(`${RADARR}/api/v3/importlist/${req.params.id}`, {
      method: 'PUT',
      headers: { 'X-Api-Key': RADARR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify(list),
    });
    if (!putRes.ok) throw new Error(`Update list ${putRes.status}`);

    res.json({ ok: true, enabled: list.enabled });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle list', detail: err.message });
  }
});

// Delete an import list
router.delete('/radarr/lists/:id', async (req, res) => {
  try {
    const r = await fetch(`${RADARR}/api/v3/importlist/${req.params.id}`, {
      method: 'DELETE',
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!r.ok) throw new Error(`Delete list ${r.status}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete list', detail: err.message });
  }
});

// Sonarr equivalents
router.get('/sonarr/lists', async (req, res) => {
  try {
    const r = await fetch(`${SONARR}/api/v3/importlist`, {
      headers: { 'X-Api-Key': SONARR_KEY() },
    });
    if (!r.ok) throw new Error(`Sonarr lists ${r.status}`);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lists', detail: err.message });
  }
});

router.patch('/sonarr/lists/:id/toggle', async (req, res) => {
  try {
    const getRes = await fetch(`${SONARR}/api/v3/importlist/${req.params.id}`, {
      headers: { 'X-Api-Key': SONARR_KEY() },
    });
    if (!getRes.ok) throw new Error(`Get list ${getRes.status}`);
    const list = await getRes.json();

    list.enabled = !list.enabled;
    list.enableAuto = list.enabled;

    const putRes = await fetch(`${SONARR}/api/v3/importlist/${req.params.id}`, {
      method: 'PUT',
      headers: { 'X-Api-Key': SONARR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify(list),
    });
    if (!putRes.ok) throw new Error(`Update list ${putRes.status}`);

    res.json({ ok: true, enabled: list.enabled });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle list', detail: err.message });
  }
});

router.delete('/sonarr/lists/:id', async (req, res) => {
  try {
    const r = await fetch(`${SONARR}/api/v3/importlist/${req.params.id}`, {
      method: 'DELETE',
      headers: { 'X-Api-Key': SONARR_KEY() },
    });
    if (!r.ok) throw new Error(`Delete list ${r.status}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete list', detail: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// DOWNLOAD CLIENTS — PRIORITY & CONFIG
// ══════════════════════════════════════════════════════════════

router.get('/radarr/downloadclients', async (req, res) => {
  try {
    const r = await fetch(`${RADARR}/api/v3/downloadclient`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!r.ok) throw new Error(`Radarr download clients ${r.status}`);
    const clients = await r.json();
    res.json(clients.map(c => ({
      id: c.id,
      name: c.name,
      implementation: c.implementation,
      protocol: c.protocol,
      priority: c.priority,
      enabled: c.enable,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch download clients', detail: err.message });
  }
});

// Update download client priority
router.patch('/radarr/downloadclients/:id/priority', async (req, res) => {
  const { priority } = req.body;
  try {
    const getRes = await fetch(`${RADARR}/api/v3/downloadclient/${req.params.id}`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!getRes.ok) throw new Error(`Get client ${getRes.status}`);
    const client = await getRes.json();

    client.priority = priority;

    const putRes = await fetch(`${RADARR}/api/v3/downloadclient/${req.params.id}`, {
      method: 'PUT',
      headers: { 'X-Api-Key': RADARR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify(client),
    });
    if (!putRes.ok) throw new Error(`Update client ${putRes.status}`);

    res.json({ ok: true, priority });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update priority', detail: err.message });
  }
});

// Toggle download client enabled
router.patch('/radarr/downloadclients/:id/toggle', async (req, res) => {
  try {
    const getRes = await fetch(`${RADARR}/api/v3/downloadclient/${req.params.id}`, {
      headers: { 'X-Api-Key': RADARR_KEY() },
    });
    if (!getRes.ok) throw new Error(`Get client ${getRes.status}`);
    const client = await getRes.json();

    client.enable = !client.enable;

    const putRes = await fetch(`${RADARR}/api/v3/downloadclient/${req.params.id}`, {
      method: 'PUT',
      headers: { 'X-Api-Key': RADARR_KEY(), 'Content-Type': 'application/json' },
      body: JSON.stringify(client),
    });
    if (!putRes.ok) throw new Error(`Update client ${putRes.status}`);

    res.json({ ok: true, enabled: client.enable });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle client', detail: err.message });
  }
});

export default router;
