import { useState, useEffect, useMemo } from 'react';
import {
  HardDrive, Activity, Users, Download, Shield, Copy, Trash2, RefreshCw,
  CheckCircle, XCircle, Wifi, Server, Plus, Film, Tv, Search, Eye, EyeOff,
  AlertTriangle, RotateCcw, Pause, Play, List, Database, Zap, Ban, BookOpen, ExternalLink, Monitor
} from 'lucide-react';
import {
  getHealth, getDownloads, getUsers, deleteUser, updateUserRole,
  getServices, createInvite, getInvites, getAdminRequests, deleteRequest, approveRequest, rejectRequest,
  getLibraryMovies, getLibraryShows, getLibraryStats,
  deleteMovie, deleteShow, toggleMovieMonitor, toggleShowMonitor,
  searchMovie, searchShow,
  getQueue, removeFromQueue, retryQueueItem, pauseSabnzbd, resumeSabnzbd,
  getMdbLists, getRadarrLists, getSonarrLists,
  getRadarrProfiles, getSonarrProfiles,
  getRadarrBlocklist, clearBlocklistEntry,
  refreshRadarr, refreshSonarr,
  getOverseerrUsers, updateOverseerrPermission,
  getRadarrProfilesFull, getSonarrProfilesFull,
  getRadarrListsFull, getSonarrListsFull,
  toggleRadarrList, toggleSonarrList, deleteRadarrList, deleteSonarrList,
  getDownloadClients, updateClientPriority, toggleDownloadClient,
  searchAllMissing, searchAllMissingShows, fixPriorities, requestBatch,
} from '../lib/api.js';

export default function Admin() {
  const [tab, setTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'library', label: 'Library', icon: Film },
    { id: 'queue', label: 'Queue', icon: Download },
    { id: 'discovery', label: 'Discovery', icon: Zap },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'invites', label: 'Invites', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Database },
  ];

  return (
    <div className="pt-24 pb-12 px-4 sm:px-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Thea Control Panel</h1>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-thea-card rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-thea-accent text-white' : 'text-thea-muted hover:text-thea-text hover:bg-white/5'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'library' && <LibraryTab />}
      {tab === 'queue' && <QueueTab />}
      {tab === 'discovery' && <DiscoveryTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'invites' && <InvitesTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD TAB (existing — unchanged)
// ══════════════════════════════════════════════════════════════

function DashboardTab() {
  const [health, setHealth] = useState(null);
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    Promise.all([getHealth(), getServices(), getLibraryStats().catch(() => null)])
      .then(([h, s, st]) => { setHealth(h); setServices(s); setStats(st); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={HardDrive} label="Disk Usage" value={health?.disk?.usePercent || 'N/A'}
          detail={`${health?.disk?.used || '?'} / ${health?.disk?.total || '?'}`} color="text-blue-400" />
        <StatCard icon={Film} label="Movies" value={stats ? `${stats.movies?.downloaded || 0}` : 'N/A'}
          detail={stats ? `${stats.movies?.missing || 0} missing · ${stats.movies?.total || 0} total` : ''} color="text-green-400" />
        <StatCard icon={Tv} label="TV Shows" value={stats ? `${stats.shows?.total || 0}` : 'N/A'}
          detail={stats ? `${stats.shows?.continuing || 0} continuing` : ''} color="text-purple-400" />
        <StatCard icon={Wifi} label="VPN" value={health?.vpn?.active ? 'Active' : 'Down'}
          detail={health?.vpn?.externalIp || 'N/A'} color={health?.vpn?.active ? 'text-green-400' : 'text-red-400'} />
      </div>

      {/* Services status */}
      <div className="bg-thea-card border border-thea-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Services</h3>
          <button onClick={refresh} className="p-1.5 rounded-lg text-thea-muted hover:text-thea-text hover:bg-white/5">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {services.map(svc => (
            <div key={svc.name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-thea-surface">
              <span className="text-sm font-medium">{svc.name}</span>
              <div className="flex items-center gap-2">
                {svc.status === 'online' ? (
                  <><CheckCircle className="w-4 h-4 text-green-400" /><span className="text-xs text-green-400">Online</span></>
                ) : (
                  <><XCircle className="w-4 h-4 text-red-400" /><span className="text-xs text-red-400">{svc.status}</span></>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Docker containers */}
      {health?.containers?.length > 0 && (
        <div className="bg-thea-card border border-thea-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Docker Containers</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {health.containers.map(c => (
              <div key={c.name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-thea-surface">
                <span className="text-sm font-medium">{c.name}</span>
                <span className={`text-xs ${c.status?.includes('Up') ? 'text-green-400' : 'text-red-400'}`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-thea-muted">Server uptime: {health?.uptime || 'N/A'}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// LIBRARY TAB — Browse, delete, monitor/unmonitor, re-search
// ══════════════════════════════════════════════════════════════

function LibraryTab() {
  const [mediaType, setMediaType] = useState('movies');
  const [movies, setMovies] = useState([]);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, downloaded, missing, unmonitored
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    if (mediaType === 'movies') {
      getLibraryMovies().then(setMovies).catch(() => {}).finally(() => setLoading(false));
    } else {
      getLibraryShows().then(setShows).catch(() => {}).finally(() => setLoading(false));
    }
  }, [mediaType]);

  const filteredMovies = useMemo(() => {
    let list = movies;
    if (filter) list = list.filter(m => m.title.toLowerCase().includes(filter.toLowerCase()));
    if (filterStatus === 'downloaded') list = list.filter(m => m.hasFile);
    if (filterStatus === 'missing') list = list.filter(m => m.monitored && !m.hasFile);
    if (filterStatus === 'unmonitored') list = list.filter(m => !m.monitored);
    return list.sort((a, b) => a.title.localeCompare(b.title));
  }, [movies, filter, filterStatus]);

  const filteredShows = useMemo(() => {
    let list = shows;
    if (filter) list = list.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()));
    return list.sort((a, b) => a.title.localeCompare(b.title));
  }, [shows, filter]);

  const showMsg = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

  const handleDeleteMovie = async (movie) => {
    if (!confirm(`Delete "${movie.title}" from Radarr?\n\nThis will also delete the file from disk.`)) return;
    try {
      await deleteMovie(movie.id, true);
      setMovies(movies.filter(m => m.id !== movie.id));
      showMsg(`Deleted "${movie.title}"`);
    } catch (err) { showMsg(`Failed: ${err.message}`); }
  };

  const handleDeleteShow = async (show) => {
    if (!confirm(`Delete "${show.title}" from Sonarr?\n\nThis will also delete all episode files.`)) return;
    try {
      await deleteShow(show.id, true);
      setShows(shows.filter(s => s.id !== show.id));
      showMsg(`Deleted "${show.title}"`);
    } catch (err) { showMsg(`Failed: ${err.message}`); }
  };

  const handleToggleMonitor = async (item) => {
    try {
      const result = mediaType === 'movies'
        ? await toggleMovieMonitor(item.id)
        : await toggleShowMonitor(item.id);
      if (mediaType === 'movies') {
        setMovies(movies.map(m => m.id === item.id ? { ...m, monitored: result.monitored } : m));
      } else {
        setShows(shows.map(s => s.id === item.id ? { ...s, monitored: result.monitored } : s));
      }
      showMsg(`${item.title}: ${result.monitored ? 'Monitoring' : 'Unmonitored'}`);
    } catch (err) { showMsg(`Failed: ${err.message}`); }
  };

  const handleSearch = async (item) => {
    try {
      const result = mediaType === 'movies'
        ? await searchMovie(item.id)
        : await searchShow(item.id);
      showMsg(result.message || `Search triggered for "${item.title}"`);
    } catch (err) { showMsg(`Failed: ${err.message}`); }
  };

  const items = mediaType === 'movies' ? filteredMovies : filteredShows;

  return (
    <div className="space-y-4">
      {/* Action message toast */}
      {actionMsg && (
        <div className="fixed top-20 right-4 z-50 bg-thea-accent text-white px-4 py-2 rounded-xl text-sm shadow-lg animate-pulse">
          {actionMsg}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex bg-thea-card rounded-lg p-0.5">
          <button onClick={() => setMediaType('movies')}
            className={`px-3 py-1.5 text-sm rounded-md ${mediaType === 'movies' ? 'bg-thea-accent text-white' : 'text-thea-muted'}`}>
            <Film className="w-4 h-4 inline mr-1" />Movies ({movies.length})
          </button>
          <button onClick={() => setMediaType('shows')}
            className={`px-3 py-1.5 text-sm rounded-md ${mediaType === 'shows' ? 'bg-thea-accent text-white' : 'text-thea-muted'}`}>
            <Tv className="w-4 h-4 inline mr-1" />Shows ({shows.length})
          </button>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thea-muted" />
          <input type="text" placeholder="Filter by title..."
            value={filter} onChange={e => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-thea-card border border-thea-border rounded-lg text-sm text-thea-text placeholder:text-thea-muted focus:outline-none focus:border-thea-accent" />
        </div>

        {mediaType === 'movies' && (
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-thea-card border border-thea-border rounded-lg px-3 py-2 text-sm text-thea-text">
            <option value="all">All</option>
            <option value="downloaded">Downloaded</option>
            <option value="missing">Missing</option>
            <option value="unmonitored">Unmonitored</option>
          </select>
        )}
      </div>

      {/* Batch Actions */}
      <div className="flex gap-2 flex-wrap mt-3">
        <button onClick={async () => {
          if (!confirm('Search for ALL missing movies? This will trigger downloads for everything Radarr is monitoring but hasn\'t found yet.')) return;
          try {
            const r = await searchAllMissing();
            alert(r.message || 'Search triggered!');
          } catch (err) { alert('Failed: ' + err.message); }
        }}
          className="flex items-center gap-1.5 bg-thea-accent hover:bg-thea-accent-hover text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-colors">
          <Download className="w-3.5 h-3.5" /> Download All Missing Movies
        </button>
        <button onClick={async () => {
          if (!confirm('Search for ALL missing TV episodes?')) return;
          try {
            const r = await searchAllMissingShows();
            alert(r.message || 'Search triggered!');
          } catch (err) { alert('Failed: ' + err.message); }
        }}
          className="flex items-center gap-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-colors">
          <Download className="w-3.5 h-3.5" /> Download All Missing Episodes
        </button>
        <button onClick={async () => {
          try {
            const r = await fixPriorities();
            alert(r.message || 'Priorities fixed!');
          } catch (err) { alert('Failed: ' + err.message); }
        }}
          className="flex items-center gap-1.5 bg-thea-surface border border-thea-border hover:border-thea-accent text-thea-text text-xs font-medium py-1.5 px-3 rounded-lg transition-colors">
          <Zap className="w-3.5 h-3.5" /> Fix Client Priorities
        </button>
      </div>

      {/* Library list */}
      {loading ? <Spinner /> : (
        <div className="bg-thea-card border border-thea-border rounded-xl overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-thea-muted py-8 text-center">No items found</p>
            ) : (
              items.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-thea-border/50 hover:bg-thea-surface/50 transition-colors">
                  {/* Poster thumbnail */}
                  {item.poster ? (
                    <img src={item.poster} alt="" className="w-10 h-14 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-14 bg-thea-surface rounded flex items-center justify-center">
                      <Film className="w-5 h-5 text-thea-muted" />
                    </div>
                  )}

                  {/* Title & meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title} <span className="text-thea-muted">({item.year})</span></p>
                    <div className="flex items-center gap-2 text-xs text-thea-muted mt-0.5">
                      {mediaType === 'movies' ? (
                        <>
                          {item.hasFile ? (
                            <span className="text-green-400">{item.quality || 'Downloaded'}</span>
                          ) : (
                            <span className="text-amber-400">Missing</span>
                          )}
                          <span>&middot;</span>
                          <span>{formatBytes(item.sizeOnDisk)}</span>
                        </>
                      ) : (
                        <>
                          <span>{item.episodeFileCount}/{item.episodeCount} episodes</span>
                          <span>&middot;</span>
                          <span>{item.network}</span>
                          <span>&middot;</span>
                          <span>{formatBytes(item.sizeOnDisk)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    item.monitored ? 'bg-green-400/10 text-green-400' : 'bg-thea-border text-thea-muted'
                  }`}>
                    {item.monitored ? 'Monitored' : 'Unmonitored'}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleToggleMonitor(item)} title={item.monitored ? 'Unmonitor' : 'Monitor'}
                      className="p-1.5 rounded-lg text-thea-muted hover:text-thea-text hover:bg-white/5">
                      {item.monitored ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleSearch(item)} title="Search for download"
                      className="p-1.5 rounded-lg text-thea-muted hover:text-thea-accent hover:bg-thea-accent/10">
                      <Search className="w-4 h-4" />
                    </button>
                    <button onClick={() => mediaType === 'movies' ? handleDeleteMovie(item) : handleDeleteShow(item)}
                      title="Delete from library"
                      className="p-1.5 rounded-lg text-thea-muted hover:text-red-400 hover:bg-red-400/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// QUEUE TAB — Active downloads with cancel/retry/blocklist
// ══════════════════════════════════════════════════════════════

function QueueTab() {
  const [queue, setQueue] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  const refresh = () => {
    setLoading(true);
    Promise.all([
      getQueue().catch(() => []),
      getAdminRequests().catch(() => []),
    ]).then(([q, r]) => { setQueue(q); setRequests(r); }).finally(() => setLoading(false));
  };

  useEffect(refresh, []);
  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      Promise.all([
        getQueue().catch(() => []),
        getAdminRequests().catch(() => []),
      ]).then(([q, r]) => { setQueue(q); setRequests(r); });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const showMsg = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

  const handleRemove = async (item) => {
    if (!confirm(`Remove "${item.title}" from the download queue?`)) return;
    try {
      await removeFromQueue(item.manager, item.id, false);
      setQueue(queue.filter(q => !(q.id === item.id && q.manager === item.manager)));
      showMsg(`Removed "${item.title}"`);
    } catch (err) { showMsg(`Failed: ${err.message}`); }
  };

  const handleRetry = async (item) => {
    try {
      const result = await retryQueueItem(item.manager, item.id);
      showMsg(result.message || `Retry triggered for "${item.title}"`);
      setTimeout(refresh, 2000);
    } catch (err) { showMsg(`Failed: ${err.message}`); }
  };

  const handleBlocklist = async (item) => {
    if (!confirm(`Blocklist "${item.title}"?\n\nThis release will never be grabbed again, and a new search will start.`)) return;
    try {
      await removeFromQueue(item.manager, item.id, true);
      showMsg(`Blocklisted — searching for alternative...`);
      setTimeout(refresh, 3000);
    } catch (err) { showMsg(`Failed: ${err.message}`); }
  };

  return (
    <div className="space-y-4">
      {actionMsg && (
        <div className="fixed top-20 right-4 z-50 bg-thea-accent text-white px-4 py-2 rounded-xl text-sm shadow-lg animate-pulse">
          {actionMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-thea-muted">
          {queue.length} item{queue.length !== 1 ? 's' : ''} in queue · Auto-refreshes every 15s
        </p>
        <div className="flex gap-2">
          <button onClick={() => pauseSabnzbd().then(() => showMsg('SABnzbd paused'))}
            className="flex items-center gap-1 text-xs bg-thea-card border border-thea-border px-3 py-1.5 rounded-lg hover:bg-thea-surface">
            <Pause className="w-3 h-3" /> Pause Usenet
          </button>
          <button onClick={() => resumeSabnzbd().then(() => showMsg('SABnzbd resumed'))}
            className="flex items-center gap-1 text-xs bg-thea-card border border-thea-border px-3 py-1.5 rounded-lg hover:bg-thea-surface">
            <Play className="w-3 h-3" /> Resume Usenet
          </button>
          <button onClick={refresh} className="p-1.5 rounded-lg text-thea-muted hover:text-thea-text hover:bg-white/5">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? <Spinner /> : queue.length === 0 ? (
        <div className="bg-thea-card border border-thea-border rounded-xl p-12 text-center">
          <Download className="w-10 h-10 text-thea-muted mx-auto mb-3" />
          <p className="text-thea-muted">Queue is empty — nothing downloading right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map(item => (
            <div key={`${item.manager}-${item.id}`} className="bg-thea-card border border-thea-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-2 text-xs text-thea-muted mt-1">
                    <span className={`px-1.5 py-0.5 rounded ${
                      item.protocol === 'usenet' ? 'bg-blue-400/10 text-blue-400' : 'bg-amber-400/10 text-amber-400'
                    }`}>
                      {item.protocol || 'unknown'}
                    </span>
                    <span>{item.quality}</span>
                    <span>&middot;</span>
                    <span>{formatBytes(item.size)}</span>
                    {item.estimatedCompletionTime && (
                      <>
                        <span>&middot;</span>
                        <span>ETA: {new Date(item.estimatedCompletionTime).toLocaleTimeString()}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status warnings */}
                {item.trackedDownloadStatus === 'warning' && (
                  <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded ml-2">
                    <AlertTriangle className="w-3 h-3" /> Warning
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-thea-border rounded-full h-2.5 mb-2">
                <div className={`h-2.5 rounded-full transition-all ${
                  item.trackedDownloadStatus === 'warning' ? 'bg-amber-400' :
                  item.progress >= 100 ? 'bg-green-400' : 'bg-thea-accent'
                }`} style={{ width: `${Math.min(item.progress, 100)}%` }} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-thea-muted">{item.progress}% complete</span>

                {/* Status messages */}
                {item.statusMessages?.length > 0 && (
                  <span className="text-xs text-amber-400 truncate max-w-[300px]">
                    {item.statusMessages[0]?.messages?.[0] || item.statusMessages[0]?.title}
                  </span>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  <button onClick={() => handleRetry(item)} title="Blocklist & retry (find a different release)"
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-thea-muted hover:text-thea-accent hover:bg-thea-accent/10">
                    <RotateCcw className="w-3 h-3" /> Retry
                  </button>
                  <button onClick={() => handleBlocklist(item)} title="Blocklist this release"
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-thea-muted hover:text-amber-400 hover:bg-amber-400/10">
                    <Ban className="w-3 h-3" /> Block
                  </button>
                  <button onClick={() => handleRemove(item)} title="Remove from queue"
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-thea-muted hover:text-red-400 hover:bg-red-400/10">
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pending Approval ─────────────────────────────── */}
      {requests.filter(r => r.status === 'pending_approval').length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" /> Pending Approval
          </h3>
          <div className="space-y-2">
            {requests.filter(r => r.status === 'pending_approval').map(req => (
              <div key={req.id} className="flex items-center gap-3 bg-amber-400/5 border border-amber-400/20 rounded-xl px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-thea-surface flex items-center justify-center flex-shrink-0">
                  {req.media_type === 'tv' ? <Tv className="w-4 h-4 text-thea-muted" /> : <Film className="w-4 h-4 text-thea-muted" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{req.title}</p>
                  <p className="text-xs text-thea-muted">
                    {req.user_name || 'Unknown'} &middot; {new Date(req.created_at).toLocaleDateString()} &middot; TMDB {req.tmdb_id}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await approveRequest(req.id);
                      setRequests(requests.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));
                      showMsg(`Approved: ${req.title} — sent to Radarr`);
                    } catch (err) { showMsg(`Failed: ${err.message}`); }
                  }}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-400/10 text-green-400 hover:bg-green-400/20 font-medium flex-shrink-0"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                </button>
                <button
                  onClick={async () => {
                    try {
                      await rejectRequest(req.id);
                      setRequests(requests.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r));
                      showMsg(`Rejected: ${req.title}`);
                    } catch (err) { showMsg(`Failed: ${err.message}`); }
                  }}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/20 font-medium flex-shrink-0"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Requests ─────────────────────────────── */}
      {requests.filter(r => r.status !== 'pending_approval').length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <List className="w-5 h-5" /> All Requests
          </h3>
          <div className="space-y-2">
            {requests.filter(r => r.status !== 'pending_approval').map(req => {
              const ls = req.liveStatus || req.status;
              const statusStyles = {
                ready: { bg: 'bg-green-400/10 border-green-400/20', pill: 'bg-green-400/10 text-green-400', label: 'Ready to Watch', icon: CheckCircle },
                downloaded: { bg: 'bg-green-400/10 border-green-400/20', pill: 'bg-green-400/10 text-green-400', label: 'Downloaded', icon: CheckCircle },
                downloading: { bg: 'bg-blue-400/10 border-blue-400/20', pill: 'bg-blue-400/10 text-blue-400', label: 'Downloading', icon: Download },
                searching: { bg: 'bg-amber-400/10 border-amber-400/20', pill: 'bg-amber-400/10 text-amber-400', label: 'Searching', icon: Search },
                in_cinemas: { bg: 'bg-purple-400/10 border-purple-400/20', pill: 'bg-purple-400/10 text-purple-400', label: 'In Cinemas', icon: Monitor },
                approved: { bg: 'bg-blue-400/5 border-thea-border', pill: 'bg-blue-400/10 text-blue-400', label: 'Approved', icon: CheckCircle },
                rejected: { bg: 'bg-red-400/5 border-thea-border', pill: 'bg-red-400/10 text-red-400', label: 'Rejected', icon: XCircle },
                cancelled: { bg: 'bg-red-400/5 border-thea-border', pill: 'bg-red-400/10 text-red-400', label: 'Cancelled', icon: XCircle },
                unmonitored: { bg: 'bg-thea-card border-thea-border', pill: 'bg-thea-surface text-thea-muted', label: 'Unmonitored', icon: EyeOff },
                pending: { bg: 'bg-amber-400/5 border-thea-border', pill: 'bg-amber-400/10 text-amber-400', label: 'Pending', icon: AlertTriangle },
              };
              const style = statusStyles[ls] || statusStyles.pending;
              const StatusIcon = style.icon;

              return (
                <div key={req.id} className={`rounded-xl border px-4 py-3 ${style.bg}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-thea-surface flex items-center justify-center flex-shrink-0">
                      {req.media_type === 'tv' ? <Tv className="w-4 h-4 text-thea-muted" /> : <Film className="w-4 h-4 text-thea-muted" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{req.title}</p>
                      <div className="flex items-center gap-2 text-xs text-thea-muted mt-0.5">
                        <span>{req.user_name || 'Unknown'}</span>
                        <span>&middot;</span>
                        <span>{new Date(req.created_at).toLocaleDateString()}</span>
                        {req.quality && <>
                          <span>&middot;</span>
                          <span>{req.quality}</span>
                        </>}
                        {req.size && <>
                          <span>&middot;</span>
                          <span>{formatBytes(req.size)}</span>
                        </>}
                        {req.protocol && <>
                          <span>&middot;</span>
                          <span className={`px-1 py-0.5 rounded ${
                            req.protocol === 'usenet' ? 'bg-blue-400/10 text-blue-400' : 'bg-amber-400/10 text-amber-400'
                          }`}>{req.protocol}</span>
                        </>}
                      </div>
                    </div>

                    {/* Status pill */}
                    <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${style.pill}`}>
                      <StatusIcon className="w-3.5 h-3.5" /> {style.label}
                    </span>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(ls === 'ready' || req.inPlex) && req.plexRatingKey && (
                        <button
                          onClick={() => window.open(`https://app.plex.tv/desktop#!/server/details?key=%2Flibrary%2Fmetadata%2F${req.plexRatingKey}`, '_blank')}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-green-400/10 text-green-400 hover:bg-green-400/20 font-medium"
                        >
                          <Play className="w-3 h-3" /> Watch
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete request for "${req.title}"?\n\nThis will also remove it from Radarr/Sonarr if it hasn't downloaded yet.`)) return;
                          try {
                            await deleteRequest(req.id);
                            setRequests(requests.filter(r => r.id !== req.id));
                            showMsg(`Deleted request: ${req.title}`);
                          } catch (err) { showMsg(`Failed: ${err.message}`); }
                        }}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-thea-muted hover:text-red-400 hover:bg-red-400/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Download progress bar */}
                  {ls === 'downloading' && req.progress != null && (
                    <div className="mt-2 ml-11">
                      <div className="w-full bg-thea-border rounded-full h-2">
                        <div className="bg-blue-400 h-2 rounded-full transition-all" style={{ width: `${req.progress}%` }} />
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-thea-muted">
                        <span>{req.progress}%</span>
                        {req.eta && <span>ETA: {new Date(req.eta).toLocaleTimeString()}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// DISCOVERY TAB — MDBList, import lists, blocklist, profiles
// ══════════════════════════════════════════════════════════════

function DiscoveryTab() {
  const [section, setSection] = useState('lists');
  const [mdbLists, setMdbLists] = useState(null);
  const [radarrLists, setRadarrLists] = useState([]);
  const [sonarrLists, setSonarrLists] = useState([]);
  const [radarrProfiles, setRadarrProfiles] = useState([]);
  const [sonarrProfiles, setSonarrProfiles] = useState([]);
  const [blocklist, setBlocklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMdbLists().catch(() => null),
      getRadarrLists().catch(() => []),
      getSonarrLists().catch(() => []),
      getRadarrProfiles().catch(() => []),
      getSonarrProfiles().catch(() => []),
      getRadarrBlocklist().catch(() => []),
    ]).then(([mdb, rl, sl, rp, sp, bl]) => {
      setMdbLists(mdb);
      setRadarrLists(rl);
      setSonarrLists(sl);
      setRadarrProfiles(rp);
      setSonarrProfiles(sp);
      setBlocklist(bl);
    }).finally(() => setLoading(false));
  }, []);

  const showMsg = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

  const handleClearBlocklist = async (id) => {
    try {
      await clearBlocklistEntry(id);
      setBlocklist(blocklist.filter(b => b.id !== id));
      showMsg('Blocklist entry removed');
    } catch (err) { showMsg(`Failed: ${err.message}`); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {actionMsg && (
        <div className="fixed top-20 right-4 z-50 bg-thea-accent text-white px-4 py-2 rounded-xl text-sm shadow-lg animate-pulse">
          {actionMsg}
        </div>
      )}

      {/* Section selector */}
      <div className="flex gap-2 flex-wrap">
        {['lists', 'profiles', 'blocklist'].map(s => (
          <button key={s} onClick={() => setSection(s)}
            className={`px-3 py-1.5 text-sm rounded-lg capitalize ${
              section === s ? 'bg-thea-accent text-white' : 'bg-thea-card border border-thea-border text-thea-muted hover:text-thea-text'
            }`}>
            {s === 'lists' ? 'Import Lists' : s === 'profiles' ? 'Quality Profiles' : 'Blocklist'}
          </button>
        ))}
      </div>

      {/* Import Lists */}
      {section === 'lists' && (
        <div className="space-y-4">
          {/* MDBList */}
          <div className="bg-thea-card border border-thea-border rounded-xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-thea-accent" /> MDBList
            </h3>
            {mdbLists === null ? (
              <div className="text-sm text-amber-400 bg-amber-400/10 p-3 rounded-lg">
                MDBList API key not configured. Add <code className="bg-thea-surface px-1 rounded">MDBLIST_API_KEY</code> to your .env file on the server.
              </div>
            ) : Array.isArray(mdbLists) && mdbLists.length > 0 ? (
              <div className="space-y-2">
                {mdbLists.map(list => (
                  <div key={list.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-thea-surface">
                    <div>
                      <p className="text-sm font-medium">{list.name}</p>
                      <p className="text-xs text-thea-muted">{list.items} items · {list.mediatype || 'mixed'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-thea-muted">No MDBList lists found. Create lists at mdblist.com to auto-discover content.</p>
            )}
          </div>

          {/* Radarr Import Lists */}
          <div className="bg-thea-card border border-thea-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Film className="w-4 h-4 text-green-400" /> Radarr Import Lists
              </h3>
              <button onClick={() => refreshRadarr().then(() => showMsg('Radarr refreshing...'))}
                className="text-xs text-thea-muted hover:text-thea-text flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            {radarrLists.length === 0 ? (
              <p className="text-sm text-thea-muted">No import lists configured in Radarr.</p>
            ) : (
              <div className="space-y-2">
                {radarrLists.map(list => (
                  <div key={list.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-thea-surface">
                    <div>
                      <p className="text-sm font-medium">{list.name}</p>
                      <p className="text-xs text-thea-muted">{list.implementation} · Auto: {list.enableAuto ? 'Yes' : 'No'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${list.enabled ? 'bg-green-400/10 text-green-400' : 'bg-thea-border text-thea-muted'}`}>
                      {list.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sonarr Import Lists */}
          <div className="bg-thea-card border border-thea-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Tv className="w-4 h-4 text-purple-400" /> Sonarr Import Lists
              </h3>
              <button onClick={() => refreshSonarr().then(() => showMsg('Sonarr refreshing...'))}
                className="text-xs text-thea-muted hover:text-thea-text flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            {sonarrLists.length === 0 ? (
              <p className="text-sm text-thea-muted">No import lists configured in Sonarr.</p>
            ) : (
              <div className="space-y-2">
                {sonarrLists.map(list => (
                  <div key={list.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-thea-surface">
                    <div>
                      <p className="text-sm font-medium">{list.name}</p>
                      <p className="text-xs text-thea-muted">{list.implementation} · Auto: {list.enableAuto ? 'Yes' : 'No'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${list.enabled ? 'bg-green-400/10 text-green-400' : 'bg-thea-border text-thea-muted'}`}>
                      {list.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quality Profiles */}
      {section === 'profiles' && (
        <div className="space-y-4">
          <div className="bg-thea-card border border-thea-border rounded-xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Film className="w-4 h-4 text-green-400" /> Radarr Quality Profiles
            </h3>
            {radarrProfiles.map(p => (
              <div key={p.id} className="mb-3 p-3 rounded-lg bg-thea-surface">
                <p className="text-sm font-medium">{p.name} {p.upgradeAllowed && <span className="text-xs text-green-400 ml-1">(upgrades allowed)</span>}</p>
                <p className="text-xs text-thea-muted mt-1">Accepted: {p.items?.join(', ') || 'None configured'}</p>
              </div>
            ))}
          </div>

          <div className="bg-thea-card border border-thea-border rounded-xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Tv className="w-4 h-4 text-purple-400" /> Sonarr Quality Profiles
            </h3>
            {sonarrProfiles.map(p => (
              <div key={p.id} className="mb-3 p-3 rounded-lg bg-thea-surface">
                <p className="text-sm font-medium">{p.name} {p.upgradeAllowed && <span className="text-xs text-green-400 ml-1">(upgrades allowed)</span>}</p>
                <p className="text-xs text-thea-muted mt-1">Accepted: {p.items?.join(', ') || 'None configured'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocklist */}
      {section === 'blocklist' && (
        <div className="bg-thea-card border border-thea-border rounded-xl p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-400" /> Blocklisted Releases
          </h3>
          <p className="text-xs text-thea-muted mb-3">
            These releases failed or were manually blocked. They won't be grabbed again.
          </p>
          {blocklist.length === 0 ? (
            <p className="text-sm text-thea-muted py-4 text-center">No blocklisted releases</p>
          ) : (
            <div className="space-y-2">
              {blocklist.map(b => (
                <div key={b.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-thea-surface">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{b.title}</p>
                    <p className="text-xs text-thea-muted truncate">{b.sourceTitle}</p>
                    <p className="text-xs text-thea-muted">{b.quality} · {b.protocol} · {new Date(b.date).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => handleClearBlocklist(b.id)}
                    title="Remove from blocklist (allow re-grab)"
                    className="p-1.5 rounded-lg text-thea-muted hover:text-green-400 hover:bg-green-400/10 ml-2">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SETTINGS TAB — Full interactive controls
// ══════════════════════════════════════════════════════════════

function SettingsTab() {
  const [section, setSection] = useState('permissions');
  const [overseerrUsers, setOverseerrUsers] = useState([]);
  const [downloadClients, setDownloadClients] = useState([]);
  const [radarrLists, setRadarrLists] = useState([]);
  const [sonarrLists, setSonarrLists] = useState([]);
  const [radarrProfiles, setRadarrProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getOverseerrUsers().catch(() => []),
      getDownloadClients().catch(() => []),
      getRadarrListsFull().catch(() => []),
      getSonarrListsFull().catch(() => []),
      getRadarrProfilesFull().catch(() => []),
    ]).then(([ou, dc, rl, sl, rp]) => {
      setOverseerrUsers(ou);
      setDownloadClients(dc);
      setRadarrLists(rl);
      setSonarrLists(sl);
      setRadarrProfiles(rp);
    }).finally(() => setLoading(false));
  }, []);

  const showMsg = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

  const handlePermToggle = async (userId, flag, currentValue) => {
    try {
      await updateOverseerrPermission(userId, flag, !currentValue);
      setOverseerrUsers(users => users.map(u =>
        u.id === userId ? { ...u, [flag]: !currentValue } : u
      ));
      showMsg(`Permission updated`);
    } catch (err) { showMsg(`Failed: ${err.message}`); }
  };

  const handleToggleRadarrList = async (id) => {
    try {
      const result = await toggleRadarrList(id);
      setRadarrLists(lists => lists.map(l => l.id === id ? { ...l, enabled: result.enabled, enableAuto: result.enabled } : l));
      showMsg(result.enabled ? 'List enabled' : 'List disabled');
    } catch (err) { showMsg(`Failed: ${err.message}`); }
  };

  const handleDeleteRadarrList = async (id, name) => {
    if (!confirm(`Delete import list "${name}"?`)) return;
    try {
      await deleteRadarrList(id);
      setRadarrLists(lists => lists.filter(l => l.id !== id));
      showMsg('List deleted');
    } catch (err) { showMsg(`Failed: ${err.message}`); }
  };

  const handleToggleSonarrList = async (id) => {
    try {
      const result = await toggleSonarrList(id);
      setSonarrLists(lists => lists.map(l => l.id === id ? { ...l, enabled: result.enabled, enableAuto: result.enabled } : l));
      showMsg(result.enabled ? 'List enabled' : 'List disabled');
    } catch (err) { showMsg(`Failed: ${err.message}`); }
  };

  const handleClientPriority = async (id, newPriority) => {
    try {
      await updateClientPriority(id, newPriority);
      setDownloadClients(clients => clients.map(c => c.id === id ? { ...c, priority: newPriority } : c));
      showMsg(`Priority updated to ${newPriority}`);
    } catch (err) { showMsg(`Failed: ${err.message}`); }
  };

  const handleToggleClient = async (id) => {
    try {
      const result = await toggleDownloadClient(id);
      setDownloadClients(clients => clients.map(c => c.id === id ? { ...c, enabled: result.enabled } : c));
      showMsg(result.enabled ? 'Client enabled' : 'Client disabled');
    } catch (err) { showMsg(`Failed: ${err.message}`); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {actionMsg && (
        <div className="fixed top-20 right-4 z-50 bg-thea-accent text-white px-4 py-2 rounded-xl text-sm shadow-lg animate-pulse">
          {actionMsg}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'permissions', label: 'User Permissions' },
          { id: 'clients', label: 'Download Clients' },
          { id: 'lists', label: 'Import Lists' },
          { id: 'profiles', label: 'Quality Profiles' },
          { id: 'protocol', label: 'Thea Protocol' },
          { id: 'services', label: 'Service Consoles' },
        ].map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              section === s.id ? 'bg-thea-accent text-white' : 'bg-thea-card border border-thea-border text-thea-muted hover:text-thea-text'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── User Permissions (Overseerr) ── */}
      {section === 'permissions' && (
        <div className="bg-thea-card border border-thea-border rounded-xl p-5">
          <h3 className="font-semibold mb-1">Overseerr User Permissions</h3>
          <p className="text-xs text-thea-muted mb-4">Control who can request content and who gets auto-approved.</p>

          {overseerrUsers.length === 0 ? (
            <p className="text-sm text-thea-muted py-4 text-center">No Overseerr users found. Is Overseerr running?</p>
          ) : (
            <div className="space-y-3">
              {overseerrUsers.map(u => (
                <div key={u.id} className="bg-thea-surface rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {u.avatar ? (
                      <img src={u.avatar} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-thea-accent/20 flex items-center justify-center text-thea-accent text-xs font-medium">
                        {u.displayName?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{u.displayName}</p>
                      <p className="text-xs text-thea-muted">{u.email} · {u.requestCount} requests</p>
                    </div>
                    {u.isAdmin && (
                      <span className="text-xs bg-thea-accent/20 text-thea-accent px-2 py-0.5 rounded-full ml-auto">Admin</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <ToggleButton label="Can Request" active={u.canRequest}
                      onClick={() => handlePermToggle(u.id, 'request', u.canRequest)} />
                    <ToggleButton label="Auto-Approve All" active={u.autoApprove}
                      onClick={() => handlePermToggle(u.id, 'autoApprove', u.autoApprove)} />
                    <ToggleButton label="Auto Movies" active={u.autoApproveMovies}
                      onClick={() => handlePermToggle(u.id, 'autoApproveMovies', u.autoApproveMovies)} />
                    <ToggleButton label="Auto TV" active={u.autoApproveTv}
                      onClick={() => handlePermToggle(u.id, 'autoApproveTv', u.autoApproveTv)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Download Clients ── */}
      {section === 'clients' && (
        <div className="bg-thea-card border border-thea-border rounded-xl p-5">
          <h3 className="font-semibold mb-1">Download Clients</h3>
          <p className="text-xs text-thea-muted mb-4">Priority 1 is tried first. Lower number = higher priority.</p>

          {downloadClients.length === 0 ? (
            <p className="text-sm text-thea-muted py-4 text-center">No download clients found.</p>
          ) : (
            <div className="space-y-3">
              {downloadClients.sort((a, b) => a.priority - b.priority).map(client => (
                <div key={client.id} className="flex items-center gap-4 bg-thea-surface rounded-xl p-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{client.name}</p>
                    <p className="text-xs text-thea-muted">{client.implementation} · {client.protocol}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-thea-muted">Priority:</span>
                    <select value={client.priority}
                      onChange={e => handleClientPriority(client.id, parseInt(e.target.value))}
                      className="bg-thea-bg border border-thea-border rounded px-2 py-1 text-sm text-thea-text">
                      <option value={1}>1 (First)</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={5}>5</option>
                      <option value={10}>10 (Last)</option>
                    </select>
                  </div>

                  <ToggleButton label={client.enabled ? 'Enabled' : 'Disabled'} active={client.enabled}
                    onClick={() => handleToggleClient(client.id)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Import Lists ── */}
      {section === 'lists' && (
        <div className="space-y-4">
          <div className="bg-thea-card border border-thea-border rounded-xl p-5">
            <h3 className="font-semibold mb-1 flex items-center gap-2">
              <Film className="w-4 h-4 text-green-400" /> Radarr Import Lists
            </h3>
            <p className="text-xs text-thea-muted mb-3">These lists auto-add movies matching your criteria into Radarr.</p>

            {radarrLists.length === 0 ? (
              <p className="text-sm text-thea-muted py-4 text-center">No import lists configured.</p>
            ) : (
              <div className="space-y-2">
                {radarrLists.map(list => (
                  <div key={list.id} className="flex items-center gap-3 bg-thea-surface rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{list.name}</p>
                      <p className="text-xs text-thea-muted">{list.implementation} · Root: {list.rootFolderPath}</p>
                    </div>
                    <ToggleButton label={list.enabled ? 'Active' : 'Off'} active={list.enabled}
                      onClick={() => handleToggleRadarrList(list.id)} />
                    <button onClick={() => handleDeleteRadarrList(list.id, list.name)}
                      className="p-1.5 rounded-lg text-thea-muted hover:text-red-400 hover:bg-red-400/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-thea-card border border-thea-border rounded-xl p-5">
            <h3 className="font-semibold mb-1 flex items-center gap-2">
              <Tv className="w-4 h-4 text-purple-400" /> Sonarr Import Lists
            </h3>
            <p className="text-xs text-thea-muted mb-3">These lists auto-add TV shows into Sonarr.</p>

            {sonarrLists.length === 0 ? (
              <p className="text-sm text-thea-muted py-4 text-center">No import lists configured.</p>
            ) : (
              <div className="space-y-2">
                {sonarrLists.map(list => (
                  <div key={list.id} className="flex items-center gap-3 bg-thea-surface rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{list.name}</p>
                      <p className="text-xs text-thea-muted">{list.implementation}</p>
                    </div>
                    <ToggleButton label={list.enabled ? 'Active' : 'Off'} active={list.enabled}
                      onClick={() => handleToggleSonarrList(list.id)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Quality Profiles ── */}
      {section === 'profiles' && (
        <div className="bg-thea-card border border-thea-border rounded-xl p-5">
          <h3 className="font-semibold mb-1">Radarr Quality Profiles</h3>
          <p className="text-xs text-thea-muted mb-4">These control what file quality Radarr will grab.</p>

          {radarrProfiles.map(profile => (
            <div key={profile.id} className="bg-thea-surface rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold">{profile.name}</p>
                  <p className="text-xs text-thea-muted">
                    Upgrades: {profile.upgradeAllowed ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-thea-muted">Allowed qualities:</p>
                <div className="flex flex-wrap gap-1.5">
                  {(profile.items || []).filter(i => i.allowed).map((item, idx) => (
                    <span key={idx} className="text-[10px] bg-green-400/10 text-green-400 px-2 py-0.5 rounded-full">
                      {item.quality?.name || item.name}
                    </span>
                  ))}
                </div>

                {(profile.items || []).some(i => !i.allowed && i.quality) && (
                  <>
                    <p className="text-xs font-medium text-thea-muted mt-2">Blocked qualities:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(profile.items || []).filter(i => !i.allowed && i.quality).map((item, idx) => (
                        <span key={idx} className="text-[10px] bg-red-400/10 text-red-400 px-2 py-0.5 rounded-full">
                          {item.quality?.name || item.name}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}

          <div className="mt-4 p-3 bg-thea-bg rounded-lg">
            <p className="text-xs text-thea-muted">
              <strong>Thea Compact target:</strong> ~1GB/movie (max 2GB) · x265/HEVC boosted (+5000) · Remux penalized (-10000) · x264 slightly penalized (-500)
            </p>
          </div>
        </div>
      )}

      {/* ── Thea Protocol ── */}
      {section === 'protocol' && (
        <div className="space-y-4">
          <div className="bg-thea-card border border-thea-border rounded-xl p-5">
            <h3 className="font-semibold mb-3">Thea Protocol — Agentic Download Chain</h3>
            <div className="text-sm text-thea-muted space-y-2 font-mono bg-thea-surface rounded-lg p-4">
              <p className="text-thea-text">REQUEST → Radarr/Sonarr search all indexers</p>
              <p className="pl-4">↓</p>
              <p className="text-blue-400 pl-4">USENET (SABnzbd + Giganews) — Priority 1</p>
              <p className="pl-8">↓ stall? → abort 15min → blocklist → next NZB</p>
              <p className="pl-8">↓ all NZBs fail?</p>
              <p className="text-amber-400 pl-4">TORRENT (qBittorrent + VPN) — Priority 2</p>
              <p className="pl-8">↓ patient — no auto-cancel on stalls</p>
              <p className="text-green-400 pl-4">POST-PROCESS → rename → /data/media/</p>
              <p className="pl-4">↓</p>
              <p className="text-purple-400 pl-4">RSYNC → Home Mac → Plex auto-detects</p>
            </div>
          </div>

          <div className="bg-thea-card border border-thea-border rounded-xl p-5">
            <h3 className="font-semibold mb-3">Services</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {[
                { name: 'Radarr', port: 7878, desc: 'Movie automation' },
                { name: 'Sonarr', port: 8989, desc: 'TV automation' },
                { name: 'Prowlarr', port: 9696, desc: 'Indexer manager' },
                { name: 'SABnzbd', port: 8080, desc: 'Usenet downloads' },
                { name: 'qBittorrent', port: 8085, desc: 'Torrent downloads (VPN)' },
                { name: 'Overseerr', port: 5055, desc: 'Request UI' },
                { name: 'Bazarr', port: 6767, desc: 'Subtitles' },
                { name: 'Lidarr', port: 8686, desc: 'Music' },
                { name: 'Notifiarr', port: 5454, desc: 'Push alerts' },
              ].map(svc => (
                <div key={svc.name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-thea-surface">
                  <span className="font-medium">{svc.name} <span className="text-thea-muted font-normal">— {svc.desc}</span></span>
                  <code className="text-xs text-thea-accent bg-thea-accent/10 px-2 py-0.5 rounded">:{svc.port}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Service Consoles (embedded UIs) ── */}
      {section === 'services' && <ServiceConsoles />}
    </div>
  );
}

function ServiceConsoles() {
  const [activeService, setActiveService] = useState(null);

  const services = [
    { id: 'radarr', name: 'Radarr', desc: 'Movie automation & search', color: 'text-yellow-400', port: 7878 },
    { id: 'sonarr', name: 'Sonarr', desc: 'TV show automation & search', color: 'text-blue-400', port: 8989 },
    { id: 'sabnzbd', name: 'SABnzbd', desc: 'Usenet download client config', color: 'text-green-400', port: 8080 },
    { id: 'prowlarr', name: 'Prowlarr', desc: 'Indexer management', color: 'text-orange-400', port: 9696 },
    { id: 'qbittorrent', name: 'qBittorrent', desc: 'Torrent client (VPN)', color: 'text-cyan-400', port: 8085 },
    { id: 'overseerr', name: 'Overseerr', desc: 'Request management', color: 'text-purple-400', port: 5055 },
    { id: 'bazarr', name: 'Bazarr', desc: 'Subtitle automation', color: 'text-pink-400', port: 6767 },
    { id: 'lidarr', name: 'Lidarr', desc: 'Music automation', color: 'text-emerald-400', port: 8686 },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-thea-card border border-thea-border rounded-xl p-5">
        <h3 className="font-semibold mb-1">Service Consoles</h3>
        <p className="text-xs text-thea-muted mb-4">
          Open any Arr service directly inside Thea. Each service has its own login (admin / Megahertz1!).
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {services.map(svc => (
            <button key={svc.id}
              onClick={() => setActiveService(activeService === svc.id ? null : svc.id)}
              className={`flex flex-col items-start p-3 rounded-xl text-left transition-colors ${
                activeService === svc.id
                  ? 'bg-thea-accent/20 border-2 border-thea-accent'
                  : 'bg-thea-surface border-2 border-transparent hover:border-thea-border'
              }`}>
              <span className={`text-sm font-semibold ${svc.color}`}>{svc.name}</span>
              <span className="text-[10px] text-thea-muted mt-0.5">{svc.desc}</span>
            </button>
          ))}
        </div>

        {activeService && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {services.find(s => s.id === activeService)?.name} Console
              </p>
              <a href={`/services/${activeService}/`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-thea-accent hover:text-thea-accent-hover">
                <ExternalLink className="w-3 h-3" /> Open in new tab
              </a>
            </div>
            <div className="rounded-xl overflow-hidden border border-thea-border" style={{ height: '70vh' }}>
              <iframe
                src={`/services/${activeService}/`}
                className="w-full h-full bg-white"
                title={`${activeService} console`}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleButton({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
        active
          ? 'bg-green-400/10 text-green-400 hover:bg-green-400/20'
          : 'bg-thea-border text-thea-muted hover:text-thea-text hover:bg-white/5'
      }`}>
      {label}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════
// USERS TAB (existing)
// ══════════════════════════════════════════════════════════════

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    await deleteUser(id);
    setUsers(users.filter(u => u.id !== id));
  };

  const handleRoleToggle = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    await updateUserRole(user.id, newRole);
    setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u));
  };

  if (loading) return <Spinner />;

  return (
    <div className="bg-thea-card border border-thea-border rounded-xl p-5">
      <h3 className="font-semibold mb-4">Users ({users.length})</h3>
      <div className="space-y-2">
        {users.map(user => (
          <div key={user.id} className="flex items-center gap-4 py-3 px-3 rounded-lg bg-thea-surface">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-thea-accent/20 flex items-center justify-center text-thea-accent text-sm font-medium">
                {user.display_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.display_name}</p>
              <p className="text-xs text-thea-muted">{user.email || 'No email'} · {user.auth_provider}</p>
            </div>
            <button onClick={() => handleRoleToggle(user)}
              className={`text-xs px-3 py-1 rounded-full font-medium ${
                user.role === 'admin' ? 'bg-thea-accent/20 text-thea-accent' : 'bg-thea-border text-thea-muted hover:text-thea-text'
              }`}>
              {user.role}
            </button>
            <button onClick={() => handleDelete(user.id, user.display_name)}
              className="p-1.5 rounded-lg text-thea-muted hover:text-red-400 hover:bg-red-400/10">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// INVITES TAB (existing)
// ══════════════════════════════════════════════════════════════

function InvitesTab() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getInvites().then(setInvites).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const invite = await createInvite(5, 30);
      setInvites([{ ...invite, uses: 0, created_at: new Date().toISOString(), created_by_name: 'You' }, ...invites]);
    } catch (err) { alert(`Failed: ${err.message}`); }
    finally { setCreating(false); }
  };

  const copyCode = (code) => navigator.clipboard.writeText(code);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-thea-muted">Share invite codes with friends to give them access to Thea.</p>
        <button onClick={handleCreate} disabled={creating}
          className="flex items-center gap-2 bg-thea-accent hover:bg-thea-accent-hover text-white text-sm font-medium py-2 px-4 rounded-xl transition-colors disabled:opacity-50">
          <Plus className="w-4 h-4" /> {creating ? 'Creating...' : 'New Code'}
        </button>
      </div>

      <div className="bg-thea-card border border-thea-border rounded-xl p-5">
        {invites.length === 0 ? (
          <p className="text-sm text-thea-muted py-4 text-center">No invite codes yet</p>
        ) : (
          <div className="space-y-2">
            {invites.map(inv => (
              <div key={inv.code} className="flex items-center gap-4 py-3 px-3 rounded-lg bg-thea-surface">
                <code className="text-sm font-mono text-thea-accent bg-thea-accent/10 px-3 py-1 rounded-lg">{inv.code}</code>
                <button onClick={() => copyCode(inv.code)}
                  className="p-1.5 rounded-lg text-thea-muted hover:text-thea-text hover:bg-white/5" title="Copy code">
                  <Copy className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0 text-xs text-thea-muted">
                  {inv.uses}/{inv.max_uses || inv.maxUses} used
                  {inv.expires_at && ` · Expires ${new Date(inv.expires_at || inv.expiresAt).toLocaleDateString()}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ══════════════════════════════════════════════════════════════

function StatCard({ icon: Icon, label, value, detail, color }) {
  return (
    <div className="bg-thea-card border border-thea-border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg bg-thea-surface ${color}`}><Icon className="w-5 h-5" /></div>
        <span className="text-sm text-thea-muted">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {detail && <p className="text-xs text-thea-muted mt-1">{detail}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-2 border-thea-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
