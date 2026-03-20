import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { searchMedia, requestMedia } from '../lib/api.js';
import MediaCard from '../components/MediaCard.jsx';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState({ library: [], discover: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      doSearch(q);
    }
  }, [searchParams]);

  const doSearch = async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchMedia(q);
      setResults(data);
    } catch {
      setResults({ library: [], discover: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
    }
  };

  const handleRequest = async (item) => {
    try {
      const result = await requestMedia(item.tmdbId, item.type, item.title);
      if (result.status === 'approved') {
        alert(`Approved: "${item.title}" is being sent to download`);
      } else if (result.status === 'pending_approval') {
        alert(`Requested: "${item.title}" — waiting for admin approval`);
      } else {
        alert(`Requested: ${item.title}`);
      }
    } catch (err) {
      alert(`Request failed: ${err.message}`);
    }
  };

  const allResults = [...results.library, ...results.discover.filter(d => !d.inLibrary)];

  return (
    <div className="pt-24 pb-12 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-10">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-thea-muted" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search for movies, TV shows..."
            autoFocus
            className="w-full pl-12 pr-4 py-4 bg-thea-card border border-thea-border rounded-2xl text-lg text-thea-text placeholder:text-thea-muted focus:outline-none focus:ring-2 focus:ring-thea-accent/50 focus:border-thea-accent transition-all"
          />
        </div>
      </form>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-thea-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && searched && allResults.length === 0 && (
        <div className="text-center py-20">
          <p className="text-thea-muted text-lg">No results found for "{searchParams.get('q')}"</p>
          <p className="text-thea-muted text-sm mt-2">Try a different search term</p>
        </div>
      )}

      {/* In Library */}
      {results.library.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            In Your Library
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {results.library.map((item, i) => (
              <MediaCard key={item.ratingKey || i} item={item} onRequest={handleRequest} />
            ))}
          </div>
        </section>
      )}

      {/* Discover */}
      {results.discover.filter(d => !d.inLibrary).length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-thea-accent" />
            Available to Request
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {results.discover.filter(d => !d.inLibrary).map((item, i) => (
              <MediaCard key={item.tmdbId || i} item={item} onRequest={handleRequest} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
