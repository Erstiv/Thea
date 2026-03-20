import { useState, useEffect } from 'react';
import { Play, Plus, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getTrending, getRecentlyAdded, requestMedia } from '../lib/api.js';
import MediaRow from '../components/MediaRow.jsx';

export default function Home() {
  const [trending, setTrending] = useState({ movies: [], tv: [] });
  const [recentlyAdded, setRecentlyAdded] = useState([]);
  const [hero, setHero] = useState(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    getTrending().then(data => {
      setTrending(data);
      // Pick a random trending movie with a backdrop for the hero
      const withBackdrop = [...data.movies, ...data.tv].filter(m => m.backdrop);
      if (withBackdrop.length) {
        setHero(withBackdrop[Math.floor(Math.random() * Math.min(5, withBackdrop.length))]);
      }
    }).catch(() => {});

    getRecentlyAdded().then(setRecentlyAdded).catch(() => {});
  }, []);

  const handleRequest = async (item) => {
    if (requesting) return;
    setRequesting(true);
    try {
      const result = await requestMedia(item.tmdbId, item.type, item.title);
      if (result.status === 'approved') {
        alert(`Approved: "${item.title}" — Radarr is searching for a release. If the movie is still in cinemas, it will download automatically when a home release becomes available.`);
      } else if (result.status === 'pending_approval') {
        alert(`Requested: "${item.title}" — waiting for admin approval`);
      } else {
        alert(`Requested: ${item.title}`);
      }
    } catch (err) {
      alert(`Request failed: ${err.message}`);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="pb-12">
      {/* Hero Section */}
      {hero && (
        <div className="relative h-[70vh] min-h-[500px] max-h-[700px] mb-8">
          <img
            src={hero.backdrop}
            alt={hero.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="hero-gradient absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-r from-thea-bg/90 via-thea-bg/40 to-transparent" />

          <div className="relative h-full flex items-end pb-16 px-4 sm:px-6 max-w-7xl mx-auto">
            <div className="max-w-lg">
              <h1 className="text-4xl sm:text-5xl font-bold mb-3 leading-tight">{hero.title}</h1>
              <div className="flex items-center gap-3 text-sm text-thea-muted mb-4">
                {hero.year && <span>{hero.year}</span>}
                {hero.rating > 0 && <span className="text-thea-gold">{hero.rating.toFixed(1)} / 10</span>}
                <span className="capitalize">{hero.type}</span>
              </div>
              <p className="text-sm text-thea-muted leading-relaxed mb-6 line-clamp-3">{hero.overview}</p>
              <div className="flex items-center gap-3">
                {hero.inLibrary ? (
                  <button className="flex items-center gap-2 bg-thea-accent hover:bg-thea-accent-hover text-white font-medium py-3 px-6 rounded-xl transition-colors">
                    <Play className="w-5 h-5" /> Watch Now
                  </button>
                ) : (
                  <button
                    onClick={() => handleRequest(hero)}
                    className="flex items-center gap-2 bg-thea-gold hover:bg-amber-400 text-black font-medium py-3 px-6 rounded-xl transition-colors"
                  >
                    <Plus className="w-5 h-5" /> Request
                  </button>
                )}
                <Link
                  to={`/${hero.type}/${hero.tmdbId || hero.ratingKey}`}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-medium py-3 px-6 rounded-xl transition-colors"
                >
                  <Info className="w-5 h-5" /> More Info
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Rows */}
      <div className={hero ? '' : 'pt-24'}>
        <MediaRow title="Recently Added to Plex" items={recentlyAdded} onRequest={handleRequest} />
        <MediaRow title="Trending Movies" items={trending.movies} onRequest={handleRequest} />
        <MediaRow title="Trending TV Shows" items={trending.tv} onRequest={handleRequest} />
      </div>
    </div>
  );
}
