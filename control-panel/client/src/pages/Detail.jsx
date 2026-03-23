import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, Plus, ExternalLink, Clock, Star, ArrowLeft, XCircle, Download, Loader, Check, RefreshCw } from 'lucide-react';
import { getMovieDetail, getTvDetail, getPlexItem, requestMedia, getWatchUrl, getMediaStatus, cancelRequest, regrabMovie } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import MediaRow from '../components/MediaRow.jsx';

export default function Detail({ type }) {
  const { id } = useParams();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [regrabbing, setRegrabbing] = useState(false);
  const [mediaStatus, setMediaStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function loadDetail() {
      const fetcher = type === 'movie' ? getMovieDetail : getTvDetail;
      try {
        const data = await fetcher(id);
        if (cancelled) return;
        setItem(data);
        // Check download/queue status
        getMediaStatus(data.tmdbId, data.type)
          .then(s => { if (!cancelled) setMediaStatus(s); })
          .catch(() => {});
      } catch {
        // TMDB lookup failed — this ID might be a Plex ratingKey, not a TMDB ID.
        // Try resolving it via the Plex fallback endpoint.
        try {
          const plexData = await getPlexItem(id);
          if (cancelled) return;
          if (plexData.redirect && plexData.tmdbId) {
            // We got a TMDB ID — redirect to the proper detail page
            window.location.replace(`/${plexData.type}/${plexData.tmdbId}`);
            return;
          }
          // No TMDB ID — show basic Plex info
          setItem({ ...plexData, ratingKey: id });
        } catch {
          if (!cancelled) setItem(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDetail();
    return () => { cancelled = true; };
  }, [id, type]);

  const handleRequest = async () => {
    if (!item || requesting) return;
    setRequesting(true);
    try {
      await requestMedia(item.tmdbId, item.type, item.title);
      // Refresh status
      const status = await getMediaStatus(item.tmdbId, item.type);
      setMediaStatus(status);
    } catch (err) {
      alert(`Request failed: ${err.message}`);
    } finally {
      setRequesting(false);
    }
  };

  const handleCancel = async () => {
    if (!item || cancelling) return;
    if (!confirm(`Cancel request for "${item.title}"?\n\nThis will stop the download and remove it from Radarr.`)) return;
    setCancelling(true);
    try {
      await cancelRequest(item.tmdbId);
      setMediaStatus(null);
    } catch (err) {
      alert(`Cancel failed: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  const handleRegrab = async () => {
    if (!item || regrabbing) return;
    if (!confirm(`Re-grab "${item.title}"?\n\nThis will delete the current (broken) file and search for a new download.`)) return;
    setRegrabbing(true);
    try {
      await regrabMovie(item.tmdbId);
      // Refresh status after a brief delay to let Radarr process
      setTimeout(async () => {
        const status = await getMediaStatus(item.tmdbId, item.type);
        setMediaStatus(status);
        setRegrabbing(false);
      }, 2000);
    } catch (err) {
      alert(`Re-grab failed: ${err.message}`);
      setRegrabbing(false);
    }
  };

  const handleWatch = async () => {
    // Use ratingKey from the item itself (Plex search results) or from the
    // Plex library cache lookup (TMDB discover results that are in Chaos/Luchagaido)
    const ratingKey = item?.ratingKey || mediaStatus?.plexRatingKey;
    if (!ratingKey) return;
    try {
      const { url } = await getWatchUrl(ratingKey);
      window.open(url, '_blank');
    } catch {
      alert('Could not get watch URL');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-thea-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="pt-24 text-center">
        <p className="text-thea-muted text-lg">Content not found</p>
        <Link to="/" className="text-thea-accent hover:underline mt-4 inline-block">Go home</Link>
      </div>
    );
  }

  // Determine what buttons to show
  const isDownloading = mediaStatus?.status === 'downloading';
  const isInRadarr = mediaStatus?.inRadarr && !mediaStatus?.hasFile;
  const isInCinemas = mediaStatus?.status === 'in_cinemas' || mediaStatus?.movieStatus === 'inCinemas';
  const isDownloaded = mediaStatus?.hasFile;
  const isInPlex = mediaStatus?.inPlex;  // in Chaos/Luchagaido but not Radarr
  const canWatch = item?.inLibrary || isDownloaded || isInPlex;
  const canCancel = (isDownloading || isInRadarr) && user?.role === 'admin';
  const isRequested = mediaStatus?.requested && !isDownloading && !isDownloaded && !isInPlex && !isInRadarr;
  const canRegrab = canWatch && user?.role === 'admin';

  return (
    <div className="pb-12">
      {/* Backdrop */}
      <div className="relative h-[60vh] min-h-[400px] max-h-[600px]">
        {item.backdrop ? (
          <img src={item.backdrop} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-thea-surface" />
        )}
        <div className="hero-gradient absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-r from-thea-bg/95 via-thea-bg/50 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="absolute top-20 left-4 sm:left-6 flex items-center gap-2 text-sm text-thea-muted hover:text-thea-text bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-48 relative z-10">
        <div className="flex gap-8">
          {/* Poster */}
          {item.poster && (
            <div className="hidden md:block flex-shrink-0">
              <img
                src={item.poster}
                alt={item.title}
                className="w-56 rounded-xl shadow-2xl shadow-black/50"
              />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">{item.title}</h1>

            {item.tagline && (
              <p className="text-thea-muted italic mb-3">{item.tagline}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-sm text-thea-muted mb-4">
              {item.year && <span>{item.year}</span>}
              {item.rating > 0 && (
                <span className="flex items-center gap-1 text-thea-gold">
                  <Star className="w-4 h-4 fill-thea-gold" /> {item.rating.toFixed(1)}
                </span>
              )}
              {item.runtime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {item.runtime} min
                </span>
              )}
              {item.seasons && <span>{item.seasons} Season{item.seasons !== 1 ? 's' : ''}</span>}
              {item.status && <span className="text-xs bg-thea-card px-2 py-0.5 rounded-full">{item.status}</span>}
            </div>

            {item.genres?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {item.genres.map(g => (
                  <span key={g} className="text-xs bg-thea-accent/10 text-thea-accent px-3 py-1 rounded-full">{g}</span>
                ))}
              </div>
            )}

            <p className="text-thea-muted leading-relaxed mb-6 max-w-2xl">{item.overview}</p>

            {/* Action buttons */}
            <div className="flex items-center gap-3 flex-wrap mb-4">
              {canWatch ? (
                <button
                  onClick={handleWatch}
                  className="flex items-center gap-2 bg-thea-accent hover:bg-thea-accent-hover text-white font-medium py-3 px-6 rounded-xl transition-colors"
                >
                  <Play className="w-5 h-5" /> Watch Now
                </button>
              ) : isDownloading ? (
                <div className="flex items-center gap-2 bg-blue-500/20 text-blue-400 font-medium py-3 px-6 rounded-xl">
                  <Loader className="w-5 h-5 animate-spin" />
                  Downloading{mediaStatus.queueItem ? ` (${mediaStatus.queueItem.progress}%)` : '...'}
                </div>
              ) : isInCinemas && isInRadarr ? (
                <div className="flex items-center gap-2 bg-purple-500/20 text-purple-400 font-medium py-3 px-6 rounded-xl">
                  <Clock className="w-5 h-5" /> In Cinemas — will auto-download when released
                </div>
              ) : isInRadarr ? (
                <div className="flex items-center gap-2 bg-amber-400/20 text-amber-400 font-medium py-3 px-6 rounded-xl">
                  <Download className="w-5 h-5" /> Searching for release...
                </div>
              ) : isRequested ? (
                <div className="flex items-center gap-2 bg-green-500/20 text-green-400 font-medium py-3 px-6 rounded-xl">
                  <Check className="w-5 h-5" /> Requested{mediaStatus.requestStatus === 'pending_approval' ? ' — Awaiting Approval' : ''}
                </div>
              ) : (
                <button
                  onClick={handleRequest}
                  disabled={requesting}
                  className="flex items-center gap-2 bg-thea-gold hover:bg-amber-400 text-black font-medium py-3 px-6 rounded-xl transition-colors disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" /> {requesting ? 'Requesting...' : 'Request'}
                </button>
              )}

              {/* Cancel button */}
              {canCancel && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium py-3 px-6 rounded-xl transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-5 h-5" /> {cancelling ? 'Cancelling...' : 'Cancel Request'}
                </button>
              )}

              {/* Re-grab button (admin only, for broken downloads) */}
              {canRegrab && (
                <button
                  onClick={handleRegrab}
                  disabled={regrabbing}
                  className="flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-medium py-3 px-6 rounded-xl transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-5 h-5 ${regrabbing ? 'animate-spin' : ''}`} /> {regrabbing ? 'Re-grabbing...' : 'Re-grab'}
                </button>
              )}

              {item.trailer && (
                <a
                  href={`https://www.youtube.com/watch?v=${item.trailer}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-xl transition-colors"
                >
                  <ExternalLink className="w-5 h-5" /> Trailer
                </a>
              )}
            </div>

            {/* Download status detail */}
            {isDownloading && mediaStatus.queueItem && (
              <div className="bg-thea-card border border-thea-border rounded-xl p-3 mb-6 max-w-md">
                <div className="flex items-center justify-between text-xs text-thea-muted mb-1.5">
                  <span>via {mediaStatus.queueItem.protocol}</span>
                  {mediaStatus.queueItem.estimatedCompletionTime && (
                    <span>ETA: {new Date(mediaStatus.queueItem.estimatedCompletionTime).toLocaleTimeString()}</span>
                  )}
                </div>
                <div className="w-full bg-thea-border rounded-full h-2">
                  <div className="bg-thea-accent h-2 rounded-full transition-all"
                    style={{ width: `${mediaStatus.queueItem.progress}%` }} />
                </div>
              </div>
            )}

            {/* Cast — NOW CLICKABLE */}
            {item.cast?.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-3">Cast</h3>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {item.cast.map((c, i) => (
                    <Link
                      key={i}
                      to={`/person/${c.id}`}
                      className="flex-shrink-0 text-center w-20 group cursor-pointer"
                    >
                      {c.photo ? (
                        <img src={c.photo} alt={c.name}
                          className="w-16 h-16 rounded-full object-cover mx-auto mb-1 border-2 border-transparent group-hover:border-thea-accent transition-colors" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-thea-card mx-auto mb-1 flex items-center justify-center text-thea-muted text-xs border-2 border-transparent group-hover:border-thea-accent transition-colors">
                          {c.name?.[0]}
                        </div>
                      )}
                      <p className="text-xs font-medium truncate group-hover:text-thea-accent transition-colors">{c.name}</p>
                      <p className="text-[10px] text-thea-muted truncate">{c.character}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Similar */}
        {item.similar?.length > 0 && (
          <div className="mt-8">
            <MediaRow title="Similar" items={item.similar} onRequest={(it) => requestMedia(it.tmdbId, it.type, it.title)} />
          </div>
        )}
      </div>
    </div>
  );
}
