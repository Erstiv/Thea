import { Router } from 'express';
import fetch from 'node-fetch';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── Plex image proxy (BEFORE auth so posters load everywhere) ──
router.get('/plex-image/*', async (req, res) => {
  try {
    const imagePath = '/' + req.params[0];
    const plexUrl = process.env.PLEX_SERVER_URL;
    const plexToken = process.env.PLEX_TOKEN;
    if (!plexUrl || !plexToken) return res.status(500).end();
    const r = await fetch(`${plexUrl}${imagePath}?X-Plex-Token=${plexToken}`);
    if (!r.ok) return res.status(r.status).end();
    res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    const buffer = await r.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch { res.status(500).end(); }
});

router.use(requireAuth);

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

// ── Unified Search (Plex library + TMDB for new content) ────

router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ library: [], discover: [] });

  const [library, discover] = await Promise.all([
    searchPlex(q),
    searchTMDB(q),
  ]);

  // Mark TMDB results that are already in the Plex library
  const libraryTitles = new Set(library.map(m => m.title.toLowerCase()));
  for (const item of discover) {
    item.inLibrary = libraryTitles.has(item.title.toLowerCase());
  }

  res.json({ library, discover });
});

// ── Browse: Trending / Popular / Recently Added ─────────────

router.get('/trending', async (req, res) => {
  try {
    const [movies, tv] = await Promise.all([
      tmdbFetch('/trending/movie/week'),
      tmdbFetch('/trending/tv/week'),
    ]);

    // Ensure Plex cache is built
    if (!_plexMovieCache) await buildPlexCache();

    const mappedMovies = (movies.results || []).slice(0, 20).map(m => {
      const item = mapTMDBMovie(m);
      if (_plexMovieCache?.has(item.tmdbId)) item.inLibrary = true;
      // Also check if already requested/in Radarr
      if (!item.inLibrary) {
        const req = db.prepare(`SELECT id FROM requests WHERE tmdb_id = ? AND status NOT IN ('rejected', 'cancelled') LIMIT 1`).get(item.tmdbId);
        if (req) item.inLibrary = true;
      }
      return item;
    });
    const mappedTv = (tv.results || []).slice(0, 20).map(t => {
      const item = mapTMDBTv(t);
      const plexKey = `tmdb:${item.tmdbId}`;
      if (_plexShowCache?.has(plexKey)) item.inLibrary = true;
      return item;
    });

    res.json({ movies: mappedMovies, tv: mappedTv });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trending' });
  }
});

router.get('/recently-added', async (req, res) => {
  try {
    const items = await getPlexRecentlyAdded();
    res.json(items);
  } catch (err) {
    res.json([]);
  }
});

// ── Single item detail ──────────────────────────────────────

router.get('/movie/:tmdbId', async (req, res) => {
  try {
    const movie = await tmdbFetch(`/movie/${req.params.tmdbId}`, '&append_to_response=credits,videos,similar');
    res.json(mapTMDBMovieDetail(movie));
  } catch (err) {
    res.status(404).json({ error: 'Movie not found' });
  }
});

router.get('/tv/:tmdbId', async (req, res) => {
  try {
    const tv = await tmdbFetch(`/tv/${req.params.tmdbId}`, '&append_to_response=credits,videos,similar');
    res.json(mapTMDBTvDetail(tv));
  } catch (err) {
    res.status(404).json({ error: 'TV show not found' });
  }
});

// ── Plex item detail (fallback for items without TMDB ID) ────

router.get('/plex/:ratingKey', async (req, res) => {
  try {
    const plexUrl = process.env.PLEX_SERVER_URL;
    const plexToken = process.env.PLEX_TOKEN;
    const r = await fetch(
      `${plexUrl}/library/metadata/${req.params.ratingKey}?X-Plex-Token=${plexToken}&includeGuids=1`,
      { headers: { Accept: 'application/json' } }
    );
    if (!r.ok) return res.status(404).json({ error: 'Plex item not found' });
    const data = await r.json();
    const item = data.MediaContainer?.Metadata?.[0];
    if (!item) return res.status(404).json({ error: 'Plex item not found' });

    // Extract TMDB ID from GUIDs
    let tmdbId = null;
    for (const g of item.Guid || []) {
      const m = g.id?.match(/^tmdb:\/\/(\d+)$/);
      if (m) { tmdbId = parseInt(m[1]); break; }
    }

    if (tmdbId) {
      // Redirect client to the TMDB detail
      return res.json({ redirect: true, tmdbId, type: item.type === 'show' ? 'tv' : 'movie' });
    }

    // No TMDB ID — return basic Plex info
    res.json({
      tmdbId: null,
      title: item.title,
      year: item.year,
      type: item.type === 'show' ? 'tv' : 'movie',
      ratingKey: item.ratingKey,
      overview: item.summary,
      poster: item.thumb ? `/api/media/plex-image${item.thumb}` : null,
      backdrop: item.art ? `/api/media/plex-image${item.art}` : null,
      rating: item.rating || 0,
      inLibrary: true,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Plex item' });
  }
});

// ── Request content (→ Overseerr → Radarr/Sonarr) ──────────

router.post('/request', async (req, res) => {
  const { tmdbId, mediaType, title } = req.body;
  if (!tmdbId || !mediaType) return res.status(400).json({ error: 'tmdbId and mediaType required' });

  // Check for duplicate request
  const existing = db.prepare(
    `SELECT id, status FROM requests WHERE tmdb_id = ? AND status NOT IN ('rejected', 'cancelled') ORDER BY created_at DESC LIMIT 1`
  ).get(tmdbId);
  if (existing) {
    return res.json({ ok: true, status: existing.status, message: 'Already requested', duplicate: true });
  }

  const isAdmin = req.user.role === 'admin';

  if (isAdmin) {
    // Admin requests go straight to Overseerr (auto-approved)
    try {
      const result = await sendToOverseerr(tmdbId, mediaType, title);
      db.prepare(`
        INSERT INTO requests (user_id, tmdb_id, media_type, title, overseerr_request_id, status)
        VALUES (?, ?, ?, ?, ?, 'approved')
      `).run(req.user.id, tmdbId, mediaType, title || 'Unknown', result.requestId || null);
      console.log(`[Request] Admin: ${title} (TMDB ${tmdbId}) → sent to Overseerr, auto-approved`);
      res.json({ ok: true, status: 'approved', requestId: result.requestId });
    } catch (err) {
      console.error('[Request] Admin request failed:', err.message);
      res.status(500).json({ error: err.message });
    }
  } else {
    // Non-admin requests need approval — store in DB only, don't send to Overseerr yet
    try {
      db.prepare(`
        INSERT INTO requests (user_id, tmdb_id, media_type, title, overseerr_request_id, status)
        VALUES (?, ?, ?, ?, NULL, 'pending_approval')
      `).run(req.user.id, tmdbId, mediaType, title || 'Unknown');
      console.log(`[Request] User ${req.user.display_name}: ${title} (TMDB ${tmdbId}) → pending admin approval`);
      res.json({ ok: true, status: 'pending_approval', message: 'Request submitted — waiting for admin approval' });
    } catch (err) {
      console.error('[Request] Failed to save:', err.message);
      res.status(500).json({ error: 'Failed to save request' });
    }
  }
});

// ── Approve a pending request (admin only) → sends to Overseerr ──

router.post('/request/:requestId/approve', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.requestId);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending_approval') return res.status(400).json({ error: `Request is already ${request.status}` });

  try {
    const result = await sendToOverseerr(request.tmdb_id, request.media_type, request.title);
    db.prepare('UPDATE requests SET status = ?, overseerr_request_id = ? WHERE id = ?')
      .run('approved', result.requestId || null, request.id);
    console.log(`[Request] Approved: ${request.title} (TMDB ${request.tmdb_id}) → sent to Overseerr`);
    res.json({ ok: true, status: 'approved' });
  } catch (err) {
    console.error('[Request] Approve failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Reject a pending request (admin only) ──

router.post('/request/:requestId/reject', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.requestId);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  db.prepare('UPDATE requests SET status = ? WHERE id = ?').run('rejected', request.id);
  console.log(`[Request] Rejected: ${request.title}`);
  res.json({ ok: true, status: 'rejected' });
});

// ── Helper: send a request to Overseerr ──

async function sendToOverseerr(tmdbId, mediaType, title) {
  const OVERSEERR = process.env.OVERSEERR_URL || 'http://localhost:5055';

  const overseerrRes = await fetch(`${OVERSEERR}/api/v1/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': process.env.OVERSEERR_API_KEY,
    },
    body: JSON.stringify({
      mediaType,
      mediaId: tmdbId,
      is4k: false,
    }),
  });

  const overseerrData = await overseerrRes.json();

  if (!overseerrRes.ok) {
    if (overseerrRes.status === 409) {
      return { requestId: null, alreadyRequested: true };
    }
    throw new Error(overseerrData.message || `Overseerr returned ${overseerrRes.status}`);
  }

  return { requestId: overseerrData.id };
}

// ── Get Plex watch URL ──────────────────────────────────────

router.get('/watch/:ratingKey', async (req, res) => {
  // Returns a Plex web URL the user can open
  const plexUrl = process.env.PLEX_SERVER_URL || 'http://99.116.182.99:32400';
  const webUrl = `https://app.plex.tv/desktop#!/server/${await getPlexMachineId()}/details?key=%2Flibrary%2Fmetadata%2F${req.params.ratingKey}`;
  res.json({ url: webUrl });
});

// ── Person detail + filmography ─────────────────────────────

router.get('/person/:personId', async (req, res) => {
  try {
    const person = await tmdbFetch(`/person/${req.params.personId}`, '&append_to_response=combined_credits');

    // Ensure Plex cache is built for library checking
    if (!_plexMovieCache) await buildPlexCache();

    const credits = person.combined_credits || {};

    // Deduplicate and sort by popularity
    const seenIds = new Set();
    const castCredits = (credits.cast || [])
      .filter(c => {
        if (seenIds.has(c.id)) return false;
        if (!['movie', 'tv'].includes(c.media_type)) return false;
        seenIds.add(c.id);
        return true;
      })
      .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
      .slice(0, 50)
      .map(c => {
        const isMovie = c.media_type === 'movie';
        const tmdbId = c.id;
        let inLibrary = false;
        if (isMovie && _plexMovieCache?.has(tmdbId)) inLibrary = true;
        if (!isMovie && _plexShowCache?.has(`tmdb:${tmdbId}`)) inLibrary = true;

        return isMovie ? {
          tmdbId, title: c.title, year: c.release_date?.slice(0, 4), type: 'movie',
          poster: c.poster_path ? `${TMDB_IMG}/w342${c.poster_path}` : null,
          rating: c.vote_average, character: c.character, overview: c.overview, inLibrary,
        } : {
          tmdbId, title: c.name, year: c.first_air_date?.slice(0, 4), type: 'tv',
          poster: c.poster_path ? `${TMDB_IMG}/w342${c.poster_path}` : null,
          rating: c.vote_average, character: c.character, overview: c.overview, inLibrary,
        };
      });

    const crewCredits = (credits.crew || [])
      .filter(c => ['Director', 'Producer', 'Writer', 'Screenplay'].includes(c.job))
      .filter(c => {
        const key = `crew-${c.id}-${c.job}`;
        if (seenIds.has(key)) return false;
        seenIds.add(key);
        return true;
      })
      .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
      .slice(0, 20)
      .map(c => {
        const isMovie = c.media_type !== 'tv';
        const tmdbId = c.id;
        let inLibrary = false;
        if (isMovie && _plexMovieCache?.has(tmdbId)) inLibrary = true;
        if (!isMovie && _plexShowCache?.has(`tmdb:${tmdbId}`)) inLibrary = true;

        return {
          tmdbId, title: c.title || c.name, year: (c.release_date || c.first_air_date)?.slice(0, 4),
          type: c.media_type === 'tv' ? 'tv' : 'movie',
          poster: c.poster_path ? `${TMDB_IMG}/w342${c.poster_path}` : null,
          rating: c.vote_average, job: c.job, inLibrary,
        };
      });

    res.json({
      id: person.id,
      name: person.name,
      biography: person.biography,
      birthday: person.birthday,
      deathday: person.deathday,
      placeOfBirth: person.place_of_birth,
      photo: person.profile_path ? `${TMDB_IMG}/w342${person.profile_path}` : null,
      knownFor: person.known_for_department,
      castCredits,
      crewCredits,
    });
  } catch (err) {
    res.status(404).json({ error: 'Person not found' });
  }
});

// ── Check Radarr/Sonarr/Plex status for a specific TMDB ID ─

router.get('/status/:tmdbId', async (req, res) => {
  const tmdbId = parseInt(req.params.tmdbId);
  const { mediaType } = req.query;

  try {
    const result = { inRadarr: false, inSonarr: false, inPlex: false, status: null, queueItem: null, requested: false };

    // Check local DB for pending/approved requests (any user)
    try {
      const dbReq = db.prepare(
        `SELECT status FROM requests WHERE tmdb_id = ? AND status IN ('pending_approval', 'approved', 'pending') ORDER BY created_at DESC LIMIT 1`
      ).get(tmdbId);
      if (dbReq) {
        result.requested = true;
        result.requestStatus = dbReq.status;
      }
    } catch {}

    if (mediaType !== 'tv') {
      // Check Radarr
      try {
        const r = await fetch(`${process.env.RADARR_URL}/api/v3/movie?tmdbId=${tmdbId}`, {
          headers: { 'X-Api-Key': process.env.RADARR_API_KEY },
        });
        if (r.ok) {
          const movies = await r.json();
          if (movies.length > 0) {
            const movie = movies[0];
            result.inRadarr = true;
            result.radarrId = movie.id;
            result.hasFile = movie.hasFile;
            result.monitored = movie.monitored;
            result.movieStatus = movie.status; // 'released', 'inCinemas', 'announced', 'tba'
            result.minimumAvailability = movie.minimumAvailability;
            result.status = movie.hasFile ? 'downloaded' : (movie.monitored ? 'searching' : 'unmonitored');
            // More specific status for in-cinema movies
            if (!movie.hasFile && movie.status === 'inCinemas') {
              result.status = 'in_cinemas';
            }
          }
        }
      } catch {}

      // Check Radarr queue
      try {
        const qr = await fetch(`${process.env.RADARR_URL}/api/v3/queue?includeMovie=true`, {
          headers: { 'X-Api-Key': process.env.RADARR_API_KEY },
        });
        if (qr.ok) {
          const qdata = await qr.json();
          const queueItem = (qdata.records || []).find(r => r.movie?.tmdbId === tmdbId);
          if (queueItem) {
            result.queueItem = {
              id: queueItem.id,
              progress: queueItem.size > 0 ? Math.round(((queueItem.size - queueItem.sizeleft) / queueItem.size) * 100) : 0,
              status: queueItem.status,
              protocol: queueItem.protocol,
              estimatedCompletionTime: queueItem.estimatedCompletionTime,
            };
            result.status = 'downloading';
          }
        }
      } catch {}

      // Check Plex library cache — catches everything in Chaos/Luchagaido
      // that Radarr doesn't know about
      try {
        if (!_plexMovieCache) await buildPlexCache();
        if (_plexMovieCache?.has(tmdbId)) {
          const plexItem = _plexMovieCache.get(tmdbId);
          result.inPlex = true;
          result.plexRatingKey = plexItem.ratingKey;
          // Only promote status if Radarr doesn't already have it downloaded
          if (!result.hasFile) {
            result.hasFile = true;
            result.status = 'in_library';
          }
        }
      } catch {}
    }

    if (mediaType === 'tv') {
      try {
        const r = await fetch(`${process.env.SONARR_URL}/api/v3/series?tvdbId=${tmdbId}`, {
          headers: { 'X-Api-Key': process.env.SONARR_API_KEY },
        });
        if (r.ok) {
          const shows = await r.json();
          if (shows.length > 0) {
            result.inSonarr = true;
            result.sonarrId = shows[0].id;
            result.status = 'monitored';
          }
        }
      } catch {}

      // Check Plex for TV shows (by TMDB guid stored in our cache)
      try {
        if (!_plexShowCache) await buildPlexCache();
        const plexKey = `tmdb:${tmdbId}`;
        if (_plexShowCache?.has(plexKey)) {
          const plexItem = _plexShowCache.get(plexKey);
          result.inPlex = true;
          result.plexRatingKey = plexItem.ratingKey;
          if (!result.inSonarr) result.status = 'in_library';
        }
      } catch {}
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Status check failed' });
  }
});

// ── Cancel a request (remove from Radarr queue) ────────────

router.delete('/cancel/:tmdbId', async (req, res) => {
  const tmdbId = parseInt(req.params.tmdbId);

  try {
    // Find the movie in Radarr
    const movieRes = await fetch(`${process.env.RADARR_URL}/api/v3/movie?tmdbId=${tmdbId}`, {
      headers: { 'X-Api-Key': process.env.RADARR_API_KEY },
    });

    if (!movieRes.ok) throw new Error('Could not find movie in Radarr');
    const movies = await movieRes.json();
    if (movies.length === 0) throw new Error('Movie not in Radarr');

    const movie = movies[0];

    // Check if it's in the queue and remove it
    const queueRes = await fetch(`${process.env.RADARR_URL}/api/v3/queue?includeMovie=true`, {
      headers: { 'X-Api-Key': process.env.RADARR_API_KEY },
    });
    if (queueRes.ok) {
      const qdata = await queueRes.json();
      const queueItem = (qdata.records || []).find(r => r.movie?.tmdbId === tmdbId);
      if (queueItem) {
        await fetch(
          `${process.env.RADARR_URL}/api/v3/queue/${queueItem.id}?removeFromClient=true&blocklist=false`,
          { method: 'DELETE', headers: { 'X-Api-Key': process.env.RADARR_API_KEY } }
        );
      }
    }

    // Delete the movie from Radarr entirely
    await fetch(
      `${process.env.RADARR_URL}/api/v3/movie/${movie.id}?deleteFiles=true&addImportExclusion=false`,
      { method: 'DELETE', headers: { 'X-Api-Key': process.env.RADARR_API_KEY } }
    );

    // Update local DB
    db.prepare('UPDATE requests SET status = ? WHERE tmdb_id = ? AND user_id = ?')
      .run('cancelled', tmdbId, req.user.id);

    res.json({ ok: true, message: 'Request cancelled and removed from download queue' });
  } catch (err) {
    res.status(500).json({ error: 'Cancel failed', detail: err.message });
  }
});

// ── User's request history (enriched with live status) ──────

router.get('/my-requests', async (req, res) => {
  const requests = db.prepare(`
    SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(req.user.id);

  const radarrUrl = process.env.RADARR_URL || 'http://localhost:7878';
  const radarrKey = process.env.RADARR_API_KEY;

  // Fetch queue once
  let radarrQueue = [];
  try {
    const qr = await fetch(`${radarrUrl}/api/v3/queue?includeMovie=true&pageSize=200`, {
      headers: { 'X-Api-Key': radarrKey },
    });
    if (qr.ok) { const qd = await qr.json(); radarrQueue = qd.records || []; }
  } catch {}

  const enriched = await Promise.all(requests.map(async (r) => {
    const e = { liveStatus: r.status, progress: null, quality: null };
    if (r.media_type === 'tv') return { ...r, ...e };

    try {
      const mr = await fetch(`${radarrUrl}/api/v3/movie?tmdbId=${r.tmdb_id}`, {
        headers: { 'X-Api-Key': radarrKey },
      });
      if (mr.ok) {
        const movies = await mr.json();
        if (movies.length > 0) {
          const movie = movies[0];
          if (movie.hasFile) {
            e.liveStatus = 'downloaded';
            e.quality = movie.movieFile?.quality?.quality?.name;
          } else {
            const qi = radarrQueue.find(q => q.movie?.tmdbId === r.tmdb_id);
            if (qi) {
              e.liveStatus = 'downloading';
              e.progress = qi.size > 0 ? Math.round(((qi.size - qi.sizeleft) / qi.size) * 100) : 0;
            } else if (movie.status === 'inCinemas') {
              e.liveStatus = 'in_cinemas';
            } else if (movie.monitored) {
              e.liveStatus = 'searching';
            }
          }
        }
      }
    } catch {}
    return { ...r, ...e };
  }));

  res.json(enriched);
});

// ── Re-grab: delete bad file and re-search (admin only) ─────

router.post('/regrab/:tmdbId', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const tmdbId = parseInt(req.params.tmdbId);

  try {
    // 1. Find the movie in Radarr
    const movieRes = await fetch(`${process.env.RADARR_URL}/api/v3/movie?tmdbId=${tmdbId}`, {
      headers: { 'X-Api-Key': process.env.RADARR_API_KEY },
    });
    if (!movieRes.ok) throw new Error('Could not find movie in Radarr');
    const movies = await movieRes.json();
    if (movies.length === 0) throw new Error('Movie not in Radarr');
    const movie = movies[0];

    // 2. If there's a file, delete it via Radarr's moviefile endpoint
    if (movie.movieFile?.id) {
      const delRes = await fetch(
        `${process.env.RADARR_URL}/api/v3/moviefile/${movie.movieFile.id}`,
        { method: 'DELETE', headers: { 'X-Api-Key': process.env.RADARR_API_KEY } }
      );
      if (!delRes.ok) console.warn(`[Regrab] File delete returned ${delRes.status}`);
    }

    // 3. Remove any existing queue items (blocklist the bad release)
    try {
      const qr = await fetch(`${process.env.RADARR_URL}/api/v3/queue?includeMovie=true`, {
        headers: { 'X-Api-Key': process.env.RADARR_API_KEY },
      });
      if (qr.ok) {
        const qdata = await qr.json();
        const queueItem = (qdata.records || []).find(r => r.movie?.tmdbId === tmdbId);
        if (queueItem) {
          await fetch(
            `${process.env.RADARR_URL}/api/v3/queue/${queueItem.id}?removeFromClient=true&blocklist=true`,
            { method: 'DELETE', headers: { 'X-Api-Key': process.env.RADARR_API_KEY } }
          );
        }
      }
    } catch {}

    // 4. Ensure movie is monitored so Radarr will search
    if (!movie.monitored) {
      await fetch(`${process.env.RADARR_URL}/api/v3/movie/${movie.id}`, {
        method: 'PUT',
        headers: { 'X-Api-Key': process.env.RADARR_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...movie, monitored: true }),
      });
    }

    // 5. Trigger a new search in Radarr
    const searchRes = await fetch(`${process.env.RADARR_URL}/api/v3/command`, {
      method: 'POST',
      headers: { 'X-Api-Key': process.env.RADARR_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'MoviesSearch', movieIds: [movie.id] }),
    });

    console.log(`[Regrab] ${movie.title} — file deleted, search triggered`);
    res.json({ ok: true, message: `Deleted bad file for "${movie.title}" and triggered re-search` });
  } catch (err) {
    console.error('[Regrab] Failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Batch request multiple movies ─────────────────────────

router.post('/request-batch', async (req, res) => {
  const { items } = req.body;  // Array of { tmdbId, mediaType, title }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }

  const results = { success: 0, failed: 0, skipped: 0, errors: [] };

  for (const item of items) {
    try {
      const overseerrRes = await fetch(`${process.env.OVERSEERR_URL}/api/v1/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': process.env.OVERSEERR_API_KEY,
        },
        body: JSON.stringify({
          mediaType: item.mediaType || 'movie',
          mediaId: item.tmdbId,
          is4k: false,
        }),
      });

      if (overseerrRes.ok || overseerrRes.status === 409) {
        // 409 = already requested, count as skipped
        if (overseerrRes.status === 409) {
          results.skipped++;
        } else {
          results.success++;
          const overseerrData = await overseerrRes.json();
          db.prepare(`
            INSERT OR IGNORE INTO requests (user_id, tmdb_id, media_type, title, overseerr_request_id, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
          `).run(req.user.id, item.tmdbId, item.mediaType || 'movie', item.title || 'Unknown', overseerrData.id || null);
        }
      } else {
        results.failed++;
        results.errors.push(`${item.title}: HTTP ${overseerrRes.status}`);
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`${item.title}: ${err.message}`);
    }
  }

  res.json({ ok: true, ...results, message: `Requested ${results.success}, skipped ${results.skipped} already requested, ${results.failed} failed` });
});

// ── DVD Releases — scrape dvdsreleasedates.com ──────────────

let _dvdCache = null;
let _dvdCacheTime = 0;
const DVD_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

router.get('/dvd-releases', async (req, res) => {
  try {
    const releases = await getDvdReleases();
    res.json(releases);
  } catch (err) {
    console.error('[DVD] Fetch failed:', err.message);
    res.json([]);
  }
});

async function getDvdReleases(force = false) {
  const now = Date.now();
  if (!force && _dvdCache && (now - _dvdCacheTime) < DVD_CACHE_TTL) return _dvdCache;

  try {
    // Fetch current month's releases page
    const r = await fetch('https://www.dvdsreleasedates.com/');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();

    // The HTML structure: date sections start with <td class='reldate ...'>
    // containing "Tuesday March 3, 2026". Movie cells are <td class='dvdcell'>
    // with <a style='color:#000;' href='/movies/ID/slug'>Title</a>
    // and imdb ratings in nearby <a href='http://www.imdb.com/title/ttXXX/'>RATING</a>

    const releases = [];

    // Split by date header rows
    const dateSections = html.split(/class='reldate[^']*'/);

    for (let i = 1; i < dateSections.length; i++) {
      const section = dateSections[i];

      // Extract date: "Tuesday March 3, 2026" or ">Tuesday March 17, 2026<"
      const dateMatch = section.match(/Tuesday\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})/);
      if (!dateMatch) continue;
      const releaseDate = new Date(dateMatch[1]);

      // Find all movies: <a style='color:#000;' href='/movies/ID/slug'>Title</a>
      const movieRegex = new RegExp("style='color:#000;' href='/movies/(\\d+)/([^']+)'>([^<]+)</a>", "g");
      let match;
      while ((match = movieRegex.exec(section)) !== null) {
        const title = match[3].trim();
        // Skip if it looks like a format link (DVD, Blu-ray, 4K)
        if (['DVD', 'Blu-ray', '4K'].includes(title)) continue;
        // Skip TV seasons
        if (/Season\s+\d|:\s*Season/i.test(title)) continue;

        // Find IMDB rating near this movie
        const nearbySlice = section.slice(Math.max(0, match.index - 200), match.index + 800);
        const imdbMatch = nearbySlice.match(/imdb\.com\/title\/(tt\d+)\/[^>]*>([\d.]+)<\/a>/);

        releases.push({
          title,
          dvdSiteId: match[1],
          slug: match[2],
          releaseDate: releaseDate.toISOString().slice(0, 10),
          imdbId: imdbMatch?.[1] || null,
          imdbRating: imdbMatch?.[2] ? parseFloat(imdbMatch[2]) : null,
        });
      }
    }

    // Deduplicate by dvdSiteId (more reliable than title)
    const seen = new Set();
    const unique = releases.filter(r => {
      if (seen.has(r.dvdSiteId)) return false;
      seen.add(r.dvdSiteId);
      return true;
    });

    console.log(`[DVD] Parsed ${unique.length} releases from HTML`);

    // Enrich with TMDB data (poster, tmdbId) — batch lookup
    const enriched = [];
    for (const rel of unique) {
      try {
        // Search TMDB by title
        const searchData = await tmdbFetch('/search/movie', `&query=${encodeURIComponent(rel.title)}`);
        const tmdbMovie = (searchData.results || [])[0];
        if (tmdbMovie) {
          enriched.push({
            ...rel,
            tmdbId: tmdbMovie.id,
            poster: tmdbMovie.poster_path ? `${TMDB_IMG}/w342${tmdbMovie.poster_path}` : null,
            backdrop: tmdbMovie.backdrop_path ? `${TMDB_IMG}/w1280${tmdbMovie.backdrop_path}` : null,
            overview: tmdbMovie.overview,
            rating: tmdbMovie.vote_average,
            year: tmdbMovie.release_date?.slice(0, 4),
            type: 'movie',
            inLibrary: false,
          });
        }
      } catch {}
    }

    // Check which ones are already in Plex or Radarr
    if (_plexMovieCache) {
      for (const item of enriched) {
        if (item.tmdbId && _plexMovieCache.has(item.tmdbId)) {
          item.inLibrary = true;
        }
      }
    }

    // Also check Radarr — if it's already being tracked (downloading, searching, etc.), mark as inLibrary
    try {
      const radarrUrl = process.env.RADARR_URL || 'http://localhost:7878';
      const radarrKey = process.env.RADARR_API_KEY;
      if (radarrKey) {
        for (const item of enriched) {
          if (item.tmdbId && !item.inLibrary) {
            try {
              const r = await fetch(`${radarrUrl}/api/v3/movie?tmdbId=${item.tmdbId}`, {
                headers: { 'X-Api-Key': radarrKey },
              });
              if (r.ok) {
                const movies = await r.json();
                if (movies.length > 0 && movies[0].monitored) {
                  item.inLibrary = true;
                }
              }
            } catch {}
          }
        }
      }
    } catch {}

    // Also check local requests DB
    for (const item of enriched) {
      if (item.tmdbId && !item.inLibrary) {
        const req = db.prepare(
          `SELECT id FROM requests WHERE tmdb_id = ? AND status NOT IN ('rejected', 'cancelled') LIMIT 1`
        ).get(item.tmdbId);
        if (req) item.inLibrary = true;
      }
    }

    _dvdCache = enriched;
    _dvdCacheTime = Date.now();
    console.log(`[DVD] Cached ${enriched.length} releases (${enriched.filter(r => r.inLibrary).length} already in Plex)`);
    return enriched;
  } catch (err) {
    console.error('[DVD] Scrape failed:', err.message);
    return _dvdCache || [];
  }
}

// ── Auto-download new DVD releases (runs every 6 hours) ─────

async function checkDvdAutoDownload() {
  try {
    const releases = await getDvdReleases(true);

    // Grab all releases on the current month's page that aren't already in library/Radarr
    const toGrab = releases.filter(r => {
      if (!r.tmdbId || r.inLibrary) return false;
      return true;
    });

    if (toGrab.length === 0) {
      console.log('[DVD Auto] No new releases to grab this month');
      return;
    }

    const grabbed = [];
    for (const rel of toGrab) {
      try {
        // Check if already in Radarr
        const checkRes = await fetch(`${process.env.RADARR_URL}/api/v3/movie?tmdbId=${rel.tmdbId}`, {
          headers: { 'X-Api-Key': process.env.RADARR_API_KEY },
        });
        if (checkRes.ok) {
          const existing = await checkRes.json();
          if (existing.length > 0) continue; // Already tracked
        }

        // Add to Radarr via Overseerr (uses existing quality profile)
        await sendToOverseerr(rel.tmdbId, 'movie', rel.title);
        grabbed.push(rel.title);

        // Also record in local DB
        db.prepare(`
          INSERT OR IGNORE INTO requests (user_id, tmdb_id, media_type, title, status)
          VALUES (1, ?, 'movie', ?, 'approved')
        `).run(rel.tmdbId, rel.title);
      } catch (err) {
        console.warn(`[DVD Auto] Failed to grab "${rel.title}": ${err.message}`);
      }
    }

    if (grabbed.length > 0) {
      console.log(`[DVD Auto] Grabbed ${grabbed.length} new releases: ${grabbed.join(', ')}`);
    }
  } catch (err) {
    console.error('[DVD Auto] Check failed:', err.message);
  }
}

// Run DVD auto-download check every 6 hours
setInterval(checkDvdAutoDownload, 6 * 60 * 60 * 1000);
// Run once on startup after a delay (let Plex cache build first)
setTimeout(checkDvdAutoDownload, 5 * 60 * 1000);

// ── Plex library cache ───────────────────────────────────────
// Builds a local map of tmdbId → { ratingKey, title } for all movies/shows
// in Plex. Refreshed every 30 minutes. Used by /status to show Chaos movies
// as "in library" even when they're not in Radarr.

let _plexMovieCache = null;   // Map<tmdbId (number), { ratingKey, title }>
let _plexShowCache  = null;   // Map<'tmdb:N' | tvdbId (number), { ratingKey, title }>
let _plexMovieReverse = null; // Map<ratingKey (string), tmdbId (number)> — reverse lookup
let _plexShowReverse  = null; // Map<ratingKey (string), tmdbId (number)> — reverse lookup
let _plexCacheTime  = 0;
let _plexCacheBuilding = false;
const PLEX_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function _plexSectionIds(type) {
  const url = process.env.PLEX_SERVER_URL;
  const tok = process.env.PLEX_TOKEN;
  if (!url || !tok) return [];
  try {
    const r = await fetch(`${url}/library/sections?X-Plex-Token=${tok}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) { console.error(`[Plex] sections HTTP ${r.status}`); return []; }
    const d = await r.json();
    const sections = (d.MediaContainer?.Directory || []).filter(s => s.type === type).map(s => s.key);
    console.log(`[Plex] Found ${sections.length} ${type} section(s): ${sections.join(', ')}`);
    return sections;
  } catch (e) { console.error(`[Plex] sections error:`, e.message); return []; }
}

async function buildPlexCache(force = false) {
  const now = Date.now();
  if (!force && _plexMovieCache && (now - _plexCacheTime) < PLEX_CACHE_TTL) return;
  if (_plexCacheBuilding) return;
  _plexCacheBuilding = true;

  const url = process.env.PLEX_SERVER_URL;
  const tok = process.env.PLEX_TOKEN;
  if (!url || !tok) { _plexCacheBuilding = false; return; }

  const movieMap = new Map();
  const showMap  = new Map();

  async function fetchSection(sectionId, plexType) {
    let start = 0;
    const PAGE = 1000;
    while (true) {
      try {
        const r = await fetch(
          `${url}/library/sections/${sectionId}/all?type=${plexType}&X-Plex-Token=${tok}&X-Plex-Container-Start=${start}&X-Plex-Container-Size=${PAGE}&includeGuids=1`,
          { headers: { Accept: 'application/json' } }
        );
        if (!r.ok) { console.error(`[Plex] section ${sectionId} HTTP ${r.status}`); break; }
        const d = await r.json();
        const items = d.MediaContainer?.Metadata || [];
        const total = d.MediaContainer?.totalSize || 0;
        if (start === 0) console.log(`[Plex] Section ${sectionId} type=${plexType}: ${total} total items`);
        for (const item of items) {
          for (const g of item.Guid || []) {
            const tmdbM = g.id?.match(/^tmdb:\/\/(\d+)$/);
            const tvdbM = g.id?.match(/^tvdb:\/\/(\d+)$/);
            if (tmdbM) {
              const id = parseInt(tmdbM[1]);
              if (plexType === 1) movieMap.set(id, { ratingKey: item.ratingKey, title: item.title });
              else showMap.set(`tmdb:${id}`, { ratingKey: item.ratingKey, title: item.title });
            }
            if (tvdbM && plexType === 2) {
              showMap.set(parseInt(tvdbM[1]), { ratingKey: item.ratingKey, title: item.title });
            }
          }
        }
        if (start + PAGE >= total || items.length === 0) break;
        start += PAGE;
      } catch { break; }
    }
  }

  try {
    const [movieSections, showSections] = await Promise.all([
      _plexSectionIds('movie'),
      _plexSectionIds('show'),
    ]);
    for (const id of movieSections) await fetchSection(id, 1);
    for (const id of showSections)  await fetchSection(id, 2);
    _plexMovieCache = movieMap;
    _plexShowCache  = showMap;
    // Build reverse caches (ratingKey → tmdbId) for Plex search enrichment
    const movieRev = new Map();
    for (const [tmdbId, val] of movieMap) movieRev.set(String(val.ratingKey), tmdbId);
    const showRev = new Map();
    for (const [key, val] of showMap) {
      if (typeof key === 'string' && key.startsWith('tmdb:')) {
        showRev.set(String(val.ratingKey), parseInt(key.replace('tmdb:', '')));
      }
    }
    _plexMovieReverse = movieRev;
    _plexShowReverse  = showRev;
    _plexCacheTime  = Date.now();
    console.log(`[Plex] Cache built: ${movieMap.size} movies, ${showMap.size} shows (reverse: ${movieRev.size} movies, ${showRev.size} shows)`);
  } catch (err) {
    console.error('[Plex] Cache build failed:', err.message);
  } finally {
    _plexCacheBuilding = false;
  }
}

// Kick off initial cache build on server start (non-blocking)
buildPlexCache().catch(() => {});

// ── Plex cache management endpoints ─────────────────────────

router.post('/plex-cache/refresh', async (req, res) => {
  buildPlexCache(true).catch(() => {});
  res.json({ ok: true, message: 'Plex library cache refresh triggered' });
});

router.get('/plex-cache/stats', (req, res) => {
  res.json({
    built: !!_plexMovieCache,
    movies: _plexMovieCache?.size ?? 0,
    shows: _plexShowCache?.size ?? 0,
    ageMinutes: _plexCacheTime ? Math.round((Date.now() - _plexCacheTime) / 60000) : null,
    building: _plexCacheBuilding,
  });
});

// ── Helper functions ────────────────────────────────────────

async function tmdbFetch(path, extra = '') {
  const r = await fetch(`${TMDB_BASE}${path}?api_key=${process.env.TMDB_API_KEY}${extra}`);
  if (!r.ok) throw new Error(`TMDB ${r.status}`);
  return r.json();
}

async function searchPlex(query) {
  try {
    const plexUrl = process.env.PLEX_SERVER_URL;
    const plexToken = process.env.PLEX_TOKEN;
    if (!plexUrl || !plexToken) return [];

    const r = await fetch(
      `${plexUrl}/hubs/search?query=${encodeURIComponent(query)}&limit=20&X-Plex-Token=${plexToken}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!r.ok) return [];
    const data = await r.json();

    // Ensure Plex cache is built so we can reverse-lookup TMDB IDs
    if (!_plexMovieReverse) await buildPlexCache();

    const results = [];
    for (const hub of data.MediaContainer?.Hub || []) {
      if (!['movie', 'show'].includes(hub.type)) continue;
      for (const item of hub.Metadata || []) {
        const isMovie = hub.type === 'movie';
        const rk = String(item.ratingKey);
        // Reverse-lookup TMDB ID from our cache
        let tmdbId = isMovie
          ? (_plexMovieReverse?.get(rk) || null)
          : (_plexShowReverse?.get(rk) || null);

        // Fallback: if not in cache, fetch this item's metadata from Plex to get GUIDs
        if (!tmdbId) {
          try {
            const metaRes = await fetch(
              `${plexUrl}/library/metadata/${item.ratingKey}?X-Plex-Token=${plexToken}&includeGuids=1`,
              { headers: { Accept: 'application/json' } }
            );
            if (metaRes.ok) {
              const metaData = await metaRes.json();
              const metaItem = metaData.MediaContainer?.Metadata?.[0];
              for (const g of metaItem?.Guid || []) {
                const m = g.id?.match(/^tmdb:\/\/(\d+)$/);
                if (m) { tmdbId = parseInt(m[1]); break; }
              }
            }
          } catch {}
        }

        results.push({
          tmdbId,
          title: item.title,
          year: item.year,
          type: isMovie ? 'movie' : 'tv',
          ratingKey: item.ratingKey,
          thumb: item.thumb ? `/api/media/plex-image${item.thumb}` : null,
          poster: item.thumb ? `/api/media/plex-image${item.thumb}` : null,
          summary: item.summary,
          rating: item.rating,
          inLibrary: true,
        });
      }
    }
    return results;
  } catch { return []; }
}

async function searchTMDB(query) {
  try {
    const data = await tmdbFetch('/search/multi', `&query=${encodeURIComponent(query)}&include_adult=false`);
    return (data.results || [])
      .filter(r => ['movie', 'tv'].includes(r.media_type))
      .slice(0, 20)
      .map(r => r.media_type === 'movie' ? mapTMDBMovie(r) : mapTMDBTv(r));
  } catch { return []; }
}

async function getPlexRecentlyAdded() {
  try {
    const plexUrl = process.env.PLEX_SERVER_URL;
    const plexToken = process.env.PLEX_TOKEN;
    if (!plexUrl || !plexToken) return [];

    const r = await fetch(
      `${plexUrl}/library/recentlyAdded?X-Plex-Token=${plexToken}&X-Plex-Container-Start=0&X-Plex-Container-Size=30`,
      { headers: { Accept: 'application/json' } }
    );
    if (!r.ok) return [];
    const data = await r.json();

    // Ensure reverse cache is built
    if (!_plexMovieReverse) await buildPlexCache();

    return (data.MediaContainer?.Metadata || []).map(item => {
      // Plex returns seasons and episodes in recently-added, not just movies/shows
      // season: type='season', parentTitle=show name, grandparentTitle=undefined
      // episode: type='episode', grandparentTitle=show name
      // movie: type='movie'
      // show: type='show'
      let title = item.title;
      let type = 'movie';

      if (item.type === 'season') {
        title = item.parentTitle || `${item.title}`;
        type = 'tv';
      } else if (item.type === 'episode') {
        title = item.grandparentTitle || item.parentTitle || item.title;
        type = 'tv';
      } else if (item.type === 'show') {
        type = 'tv';
      }

      const rk = String(item.ratingKey);
      const isMovie = type === 'movie';
      const tmdbId = isMovie
        ? (_plexMovieReverse?.get(rk) || null)
        : (_plexShowReverse?.get(rk) || null);

      // Use proxy URLs so images load from anywhere
      const thumb = item.thumb || (item.type === 'season' ? item.parentThumb : null) || (item.type === 'episode' ? item.grandparentThumb : null);
      const art = item.art || (item.type === 'season' ? item.parentArt : null) || (item.type === 'episode' ? item.grandparentArt : null);

      return {
        tmdbId,
        title,
        year: item.year,
        type,
        ratingKey: item.ratingKey,
        thumb: thumb ? `/api/media/plex-image${thumb}` : null,
        poster: thumb ? `/api/media/plex-image${thumb}` : null,
        art: art ? `/api/media/plex-image${art}` : null,
        summary: item.summary,
        addedAt: new Date(item.addedAt * 1000).toISOString(),
        inLibrary: true,
      };
    });
  } catch { return []; }
}

let plexMachineId = null;
async function getPlexMachineId() {
  if (plexMachineId) return plexMachineId;
  try {
    const r = await fetch(`${process.env.PLEX_SERVER_URL}/identity?X-Plex-Token=${process.env.PLEX_TOKEN}`, {
      headers: { Accept: 'application/json' },
    });
    const data = await r.json();
    plexMachineId = data.MediaContainer?.machineIdentifier || '';
    return plexMachineId;
  } catch { return ''; }
}

function mapTMDBMovie(m) {
  return {
    tmdbId: m.id,
    title: m.title,
    year: m.release_date?.slice(0, 4),
    type: 'movie',
    poster: m.poster_path ? `${TMDB_IMG}/w342${m.poster_path}` : null,
    backdrop: m.backdrop_path ? `${TMDB_IMG}/w1280${m.backdrop_path}` : null,
    rating: m.vote_average,
    overview: m.overview,
    inLibrary: false,
  };
}

function mapTMDBTv(t) {
  return {
    tmdbId: t.id,
    title: t.name,
    year: t.first_air_date?.slice(0, 4),
    type: 'tv',
    poster: t.poster_path ? `${TMDB_IMG}/w342${t.poster_path}` : null,
    backdrop: t.backdrop_path ? `${TMDB_IMG}/w1280${t.backdrop_path}` : null,
    rating: t.vote_average,
    overview: t.overview,
    inLibrary: false,
  };
}

function mapTMDBMovieDetail(m) {
  return {
    ...mapTMDBMovie(m),
    runtime: m.runtime,
    genres: m.genres?.map(g => g.name) || [],
    tagline: m.tagline,
    cast: (m.credits?.cast || []).slice(0, 10).map(c => ({ id: c.id, name: c.name, character: c.character, photo: c.profile_path ? `${TMDB_IMG}/w185${c.profile_path}` : null })),
    trailer: (m.videos?.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key,
    similar: (m.similar?.results || []).slice(0, 8).map(mapTMDBMovie),
  };
}

function mapTMDBTvDetail(t) {
  return {
    ...mapTMDBTv(t),
    seasons: t.number_of_seasons,
    episodes: t.number_of_episodes,
    genres: t.genres?.map(g => g.name) || [],
    tagline: t.tagline,
    status: t.status,
    cast: (t.credits?.cast || []).slice(0, 10).map(c => ({ name: c.name, character: c.character, photo: c.profile_path ? `${TMDB_IMG}/w185${c.profile_path}` : null })),
    trailer: (t.videos?.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key,
    similar: (t.similar?.results || []).slice(0, 8).map(mapTMDBTv),
  };
}

export default router;
