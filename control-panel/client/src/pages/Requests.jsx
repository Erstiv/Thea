import { useState, useEffect } from 'react';
import { Film, Tv, Clock, CheckCircle, XCircle, Download, Search, Monitor, EyeOff, Loader, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMyRequests } from '../lib/api.js';

const statusConfig = {
  pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', label: 'Pending' },
  pending_approval: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', label: 'Awaiting Approval' },
  approved: { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', label: 'Approved' },
  searching: { icon: Search, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', label: 'Searching for Release' },
  downloading: { icon: Download, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', label: 'Downloading' },
  downloaded: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20', label: 'Downloaded' },
  ready: { icon: Play, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20', label: 'Ready to Watch' },
  in_cinemas: { icon: Monitor, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20', label: 'In Cinemas' },
  unmonitored: { icon: EyeOff, color: 'text-thea-muted', bg: 'bg-thea-surface', border: 'border-thea-border', label: 'Unmonitored' },
  rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', label: 'Rejected' },
  cancelled: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', label: 'Cancelled' },
};

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    getMyRequests()
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="pt-24 flex justify-center">
        <div className="w-8 h-8 border-2 border-thea-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-24 pb-12 px-4 sm:px-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Requests</h1>

      {requests.length === 0 ? (
        <div className="text-center py-16 bg-thea-card rounded-2xl border border-thea-border">
          <p className="text-thea-muted">No requests yet. Search for something to request!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const ls = req.liveStatus || req.status;
            const cfg = statusConfig[ls] || statusConfig.pending;
            const Icon = cfg.icon;

            return (
              <Link
                key={req.id}
                to={`/${req.media_type === 'tv' ? 'tv' : 'movie'}/${req.tmdb_id}`}
                className={`block p-4 rounded-xl border transition-colors hover:bg-white/5 ${cfg.bg} ${cfg.border}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-thea-surface flex items-center justify-center flex-shrink-0">
                    {req.media_type === 'movie' ? (
                      <Film className="w-5 h-5 text-thea-muted" />
                    ) : (
                      <Tv className="w-5 h-5 text-thea-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{req.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-thea-muted mt-0.5">
                      <span>{new Date(req.created_at).toLocaleDateString()}</span>
                      <span>&middot;</span>
                      <span className="capitalize">{req.media_type}</span>
                      {req.quality && <>
                        <span>&middot;</span>
                        <span>{req.quality}</span>
                      </>}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
                    {ls === 'downloading' ? (
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                    {cfg.label}
                  </div>
                </div>

                {ls === 'downloading' && req.progress != null && (
                  <div className="mt-3 ml-14">
                    <div className="w-full bg-thea-border rounded-full h-2">
                      <div className="bg-blue-400 h-2 rounded-full transition-all" style={{ width: `${req.progress}%` }} />
                    </div>
                    <p className="text-xs text-thea-muted mt-1">{req.progress}% complete</p>
                  </div>
                )}

                {ls === 'in_cinemas' && (
                  <p className="text-xs text-purple-400 mt-2 ml-14">Will auto-download when a home release becomes available</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
