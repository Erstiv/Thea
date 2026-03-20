import { Router } from 'express';
import fetch from 'node-fetch';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { createToken, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// ── Google OAuth ────────────────────────────────────────────

// Step 1: Redirect to Google
router.get('/google', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// Step 2: Google callback
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=no_code');

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error('No access token');

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json();

    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email);
    if (!user) {
      // Check if this email was pre-approved or if registration is open
      const result = db.prepare(`
        INSERT INTO users (email, display_name, avatar_url, auth_provider, auth_provider_id)
        VALUES (?, ?, ?, 'google', ?)
      `).run(profile.email, profile.name, profile.picture, profile.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    } else {
      db.prepare(`
        UPDATE users SET display_name = ?, avatar_url = ?, last_login = datetime('now')
        WHERE id = ?
      `).run(profile.name, profile.picture, user.id);
    }

    const token = createToken(user);
    res.cookie('thea_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.redirect('/');
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect('/?error=google_auth_failed');
  }
});

// ── Plex OAuth ──────────────────────────────────────────────

// Step 1: Get a Plex pin
router.get('/plex', async (req, res) => {
  try {
    const pinRes = await fetch('https://plex.tv/api/v2/pins', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Plex-Client-Identifier': 'thea-control-panel',
        'X-Plex-Product': 'Thea Control Panel',
      },
      body: JSON.stringify({ strong: true }),
    });
    const pin = await pinRes.json();

    // Store pin ID in a short-lived cookie so we can check it later
    res.cookie('plex_pin_id', pin.id, { maxAge: 5 * 60 * 1000 });

    const forwardUrl = `${process.env.GOOGLE_REDIRECT_URI?.replace('/google/callback', '/plex/callback') || 'http://localhost:3005/auth/plex/callback'}`;
    const authUrl = `https://app.plex.tv/auth#?clientID=thea-control-panel&code=${pin.code}&forwardUrl=${encodeURIComponent(forwardUrl)}`;
    res.redirect(authUrl);
  } catch (err) {
    console.error('Plex pin error:', err);
    res.redirect('/?error=plex_auth_failed');
  }
});

// Step 2: Plex callback — check the pin
router.get('/plex/callback', async (req, res) => {
  const pinId = req.cookies?.plex_pin_id;
  if (!pinId) return res.redirect('/?error=no_plex_pin');

  try {
    // Poll the pin to get the auth token
    const pinRes = await fetch(`https://plex.tv/api/v2/pins/${pinId}`, {
      headers: {
        'Accept': 'application/json',
        'X-Plex-Client-Identifier': 'thea-control-panel',
      },
    });
    const pin = await pinRes.json();
    if (!pin.authToken) return res.redirect('/?error=plex_not_authorized');

    // Get Plex user info
    const userRes = await fetch('https://plex.tv/api/v2/user', {
      headers: {
        'Accept': 'application/json',
        'X-Plex-Token': pin.authToken,
        'X-Plex-Client-Identifier': 'thea-control-panel',
      },
    });
    const plexUser = await userRes.json();

    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(plexUser.email);
    if (!user) {
      const result = db.prepare(`
        INSERT INTO users (email, display_name, avatar_url, auth_provider, auth_provider_id)
        VALUES (?, ?, ?, 'plex', ?)
      `).run(plexUser.email, plexUser.title || plexUser.username, plexUser.thumb, String(plexUser.id));
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    } else {
      db.prepare(`
        UPDATE users SET display_name = ?, avatar_url = ?, last_login = datetime('now')
        WHERE id = ?
      `).run(plexUser.title || plexUser.username, plexUser.thumb, user.id);
    }

    const token = createToken(user);
    res.cookie('thea_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.clearCookie('plex_pin_id');
    res.redirect('/');
  } catch (err) {
    console.error('Plex callback error:', err);
    res.redirect('/?error=plex_auth_failed');
  }
});

// ── Invite Code Login ───────────────────────────────────────

router.post('/invite', (req, res) => {
  const { code, displayName, email } = req.body;
  if (!code || !displayName) {
    return res.status(400).json({ error: 'Code and display name required' });
  }

  const invite = db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(code);
  if (!invite) return res.status(400).json({ error: 'Invalid invite code' });
  if (invite.uses >= invite.max_uses) return res.status(400).json({ error: 'Invite code fully used' });
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Invite code expired' });
  }

  // Check if email already exists
  if (email) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'Email already registered' });
  }

  const result = db.prepare(`
    INSERT INTO users (email, display_name, auth_provider, invite_code_used)
    VALUES (?, ?, 'invite', ?)
  `).run(email || null, displayName, code);

  db.prepare('UPDATE invite_codes SET uses = uses + 1 WHERE code = ?').run(code);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = createToken(user);

  res.cookie('thea_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ user: { id: user.id, displayName: user.display_name, role: user.role } });
});

// ── Current user / logout ───────────────────────────────────

router.get('/me', requireAuth, (req, res) => {
  const { id, email, display_name, avatar_url, role, created_at } = req.user;
  res.json({ id, email, displayName: display_name, avatarUrl: avatar_url, role, createdAt: created_at });
});

router.post('/logout', (req, res) => {
  res.clearCookie('thea_token');
  res.json({ ok: true });
});

// ── Invite code management (admin only) ─────────────────────

router.post('/invites', requireAuth, requireAdmin, (req, res) => {
  const { maxUses = 1, expiresInDays } = req.body;
  const code = uuid().slice(0, 8).toUpperCase();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
    : null;

  db.prepare(`
    INSERT INTO invite_codes (code, created_by, max_uses, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(code, req.user.id, maxUses, expiresAt);

  res.json({ code, maxUses, expiresAt });
});

router.get('/invites', requireAuth, requireAdmin, (req, res) => {
  const invites = db.prepare(`
    SELECT ic.*, u.display_name as created_by_name
    FROM invite_codes ic
    LEFT JOIN users u ON ic.created_by = u.id
    ORDER BY ic.created_at DESC
  `).all();
  res.json(invites);
});

export default router;
