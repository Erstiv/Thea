import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import mediaRoutes from './routes/media.js';
import libraryRoutes from './routes/library.js';
import queueRoutes from './routes/queue.js';
import discoveryRoutes from './routes/discovery.js';
import settingsRoutes from './routes/settings.js';
import servicesProxy from './routes/services.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3005;

// ── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://quietferal.com'
    : ['http://localhost:5173', 'http://localhost:3005'],
  credentials: true,
}));

// ── Proxy routes for embedded service UIs ────────────────────
app.use('/services', servicesProxy);

// ── API Routes ──────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/settings', settingsRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/api/ping', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── Serve React build in production ─────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  // SPA fallback — serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || req.path.startsWith('/services/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🎬 Thea Control Panel running at http://localhost:${PORT}`);
});
