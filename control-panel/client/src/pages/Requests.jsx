import { useState, useEffect } from 'react';
import { Film, Tv, Clock, CheckCircle, XCircle } from 'lucide-react';
import { getMyRequests } from '../lib/api.js';

const statusConfig = {
  pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Pending' },
  approved: { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Approved' },
  available: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Available' },
  declined: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Declined' },
};

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyRequests()
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
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
            const cfg = statusConfig[req.status] || statusConfig.pending;
            const Icon = cfg.icon;
            return (
              <div key={req.id} className="flex items-center gap-4 p-4 bg-thea-card border border-thea-border rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-thea-surface flex items-center justify-center">
                  {req.media_type === 'movie' ? (
                    <Film className="w-5 h-5 text-thea-muted" />
                  ) : (
                    <Tv className="w-5 h-5 text-thea-muted" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{req.title}</h3>
                  <p className="text-xs text-thea-muted">
                    {new Date(req.created_at).toLocaleDateString()} &middot; {req.media_type}
                  </p>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {cfg.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
