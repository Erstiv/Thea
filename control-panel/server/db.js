import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'thea.db');

// Ensure data directory exists
import fs from 'fs';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'local',  -- 'google', 'plex', 'local'
    auth_provider_id TEXT,
    role TEXT NOT NULL DEFAULT 'user',             -- 'admin', 'user'
    invite_code_used TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS invite_codes (
    code TEXT PRIMARY KEY,
    created_by INTEGER REFERENCES users(id),
    max_uses INTEGER DEFAULT 1,
    uses INTEGER DEFAULT 0,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    tmdb_id INTEGER NOT NULL,
    media_type TEXT NOT NULL,        -- 'movie' or 'tv'
    title TEXT NOT NULL,
    overseerr_request_id INTEGER,
    status TEXT DEFAULT 'pending',   -- 'pending', 'approved', 'available', 'declined'
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed admin user if not exists
const adminEmail = process.env.ADMIN_EMAIL || 'elliots@gmail.com';
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
if (!existing) {
  db.prepare(`
    INSERT INTO users (email, display_name, role, auth_provider)
    VALUES (?, 'Elliot', 'admin', 'local')
  `).run(adminEmail);
}

export default db;
