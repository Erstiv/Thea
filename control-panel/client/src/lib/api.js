const BASE = '';  // same origin in production; vite proxy in dev

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (res.status === 401) {
    // Redirect to login if unauthorized
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Auth
export const getMe = () => apiFetch('/auth/me');
export const logout = () => apiFetch('/auth/logout', { method: 'POST' });
export const loginWithInvite = (code, displayName, email) =>
  apiFetch('/auth/invite', { method: 'POST', body: JSON.stringify({ code, displayName, email }) });

// Media
export const searchMedia = (q) => apiFetch(`/api/media/search?q=${encodeURIComponent(q)}`);
export const getTrending = () => apiFetch('/api/media/trending');
export const getRecentlyAdded = () => apiFetch('/api/media/recently-added');
export const getMovieDetail = (id) => apiFetch(`/api/media/movie/${id}`);
export const getTvDetail = (id) => apiFetch(`/api/media/tv/${id}`);
export const getPlexItem = (ratingKey) => apiFetch(`/api/media/plex/${ratingKey}`);
export const requestMedia = (tmdbId, mediaType, title) =>
  apiFetch('/api/media/request', { method: 'POST', body: JSON.stringify({ tmdbId, mediaType, title }) });
export const getWatchUrl = (ratingKey) => apiFetch(`/api/media/watch/${ratingKey}`);
export const getMyRequests = () => apiFetch('/api/media/my-requests');
export const getPersonDetail = (id) => apiFetch(`/api/media/person/${id}`);
export const getMediaStatus = (tmdbId, mediaType) => apiFetch(`/api/media/status/${tmdbId}?mediaType=${mediaType}`);
export const cancelRequest = (tmdbId) => apiFetch(`/api/media/cancel/${tmdbId}`, { method: 'DELETE' });
export const approveRequest = (id) => apiFetch(`/api/media/request/${id}/approve`, { method: 'POST' });
export const rejectRequest = (id) => apiFetch(`/api/media/request/${id}/reject`, { method: 'POST' });

// Admin
export const getHealth = () => apiFetch('/api/admin/health');
export const getDownloads = () => apiFetch('/api/admin/downloads');
export const getUsers = () => apiFetch('/api/admin/users');
export const getAdminRequests = () => apiFetch('/api/admin/requests');
export const deleteRequest = (id) => apiFetch(`/api/admin/requests/${id}`, { method: 'DELETE' });
export const deleteUser = (id) => apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
export const updateUserRole = (id, role) =>
  apiFetch(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
export const getServices = () => apiFetch('/api/admin/services');
export const createInvite = (maxUses = 1, expiresInDays) =>
  apiFetch('/auth/invites', { method: 'POST', body: JSON.stringify({ maxUses, expiresInDays }) });
export const getInvites = () => apiFetch('/auth/invites');

// Library Management
export const getLibraryMovies = () => apiFetch('/api/library/movies');
export const getLibraryShows = () => apiFetch('/api/library/shows');
export const getLibraryStats = () => apiFetch('/api/library/stats');
export const deleteMovie = (id, deleteFiles = false) =>
  apiFetch(`/api/library/movies/${id}?deleteFiles=${deleteFiles}`, { method: 'DELETE' });
export const deleteShow = (id, deleteFiles = false) =>
  apiFetch(`/api/library/shows/${id}?deleteFiles=${deleteFiles}`, { method: 'DELETE' });
export const toggleMovieMonitor = (id) =>
  apiFetch(`/api/library/movies/${id}/monitor`, { method: 'PATCH' });
export const toggleShowMonitor = (id) =>
  apiFetch(`/api/library/shows/${id}/monitor`, { method: 'PATCH' });
export const searchMovie = (id) =>
  apiFetch(`/api/library/movies/${id}/search`, { method: 'POST' });
export const searchShow = (id) =>
  apiFetch(`/api/library/shows/${id}/search`, { method: 'POST' });

// Download Queue
export const getQueue = () => apiFetch('/api/queue');
export const removeFromQueue = (manager, id, blocklist = false) =>
  apiFetch(`/api/queue/${manager}/${id}?blocklist=${blocklist}`, { method: 'DELETE' });
export const retryQueueItem = (manager, id) =>
  apiFetch(`/api/queue/${manager}/${id}/retry`, { method: 'POST' });
export const pauseSabnzbd = () => apiFetch('/api/queue/sabnzbd/pause', { method: 'POST' });
export const resumeSabnzbd = () => apiFetch('/api/queue/sabnzbd/resume', { method: 'POST' });

// Discovery & Lists
export const getMdbLists = () => apiFetch('/api/discovery/mdblist/lists');
export const getMdbListItems = (id) => apiFetch(`/api/discovery/mdblist/lists/${id}`);
export const searchMdbLists = (q) => apiFetch(`/api/discovery/mdblist/search?q=${encodeURIComponent(q || '')}`);
export const getRadarrLists = () => apiFetch('/api/discovery/radarr/lists');
export const getSonarrLists = () => apiFetch('/api/discovery/sonarr/lists');
export const getRadarrProfiles = () => apiFetch('/api/discovery/radarr/profiles');
export const getSonarrProfiles = () => apiFetch('/api/discovery/sonarr/profiles');
export const getRadarrBlocklist = () => apiFetch('/api/discovery/radarr/blocklist');
export const clearBlocklistEntry = (id) => apiFetch(`/api/discovery/radarr/blocklist/${id}`, { method: 'DELETE' });
export const refreshRadarr = () => apiFetch('/api/discovery/radarr/refresh', { method: 'POST' });
export const refreshSonarr = () => apiFetch('/api/discovery/sonarr/refresh', { method: 'POST' });

// Settings — Overseerr user permissions
export const getOverseerrUsers = () => apiFetch('/api/settings/overseerr/users');
export const updateOverseerrPermission = (userId, flag, enabled) =>
  apiFetch(`/api/settings/overseerr/users/${userId}/permissions`, {
    method: 'PATCH', body: JSON.stringify({ flag, enabled })
  });

// Settings — Quality profiles (full edit)
export const getRadarrProfilesFull = () => apiFetch('/api/settings/radarr/profiles');
export const getSonarrProfilesFull = () => apiFetch('/api/settings/sonarr/profiles');
export const updateRadarrProfile = (id, data) =>
  apiFetch(`/api/settings/radarr/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const updateSonarrProfile = (id, data) =>
  apiFetch(`/api/settings/sonarr/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Settings — Import lists (toggle, delete)
export const getRadarrListsFull = () => apiFetch('/api/settings/radarr/lists');
export const getSonarrListsFull = () => apiFetch('/api/settings/sonarr/lists');
export const toggleRadarrList = (id) => apiFetch(`/api/settings/radarr/lists/${id}/toggle`, { method: 'PATCH' });
export const toggleSonarrList = (id) => apiFetch(`/api/settings/sonarr/lists/${id}/toggle`, { method: 'PATCH' });
export const deleteRadarrList = (id) => apiFetch(`/api/settings/radarr/lists/${id}`, { method: 'DELETE' });
export const deleteSonarrList = (id) => apiFetch(`/api/settings/sonarr/lists/${id}`, { method: 'DELETE' });

// Settings — Download clients
export const getDownloadClients = () => apiFetch('/api/settings/radarr/downloadclients');
export const updateClientPriority = (id, priority) =>
  apiFetch(`/api/settings/radarr/downloadclients/${id}/priority`, { method: 'PATCH', body: JSON.stringify({ priority }) });
export const toggleDownloadClient = (id) =>
  apiFetch(`/api/settings/radarr/downloadclients/${id}/toggle`, { method: 'PATCH' });

// Library batch actions
export const searchAllMissing = () => apiFetch('/api/library/movies/search-missing', { method: 'POST' });
export const searchAllMissingShows = () => apiFetch('/api/library/shows/search-missing', { method: 'POST' });
export const fixPriorities = () => apiFetch('/api/library/fix-priorities', { method: 'POST' });

// Batch request
export const requestBatch = (items) => apiFetch('/api/media/request-batch', { method: 'POST', body: JSON.stringify({ items }) });
