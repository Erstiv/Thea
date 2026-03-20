import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, Play, Plus, Film, Clapperboard } from 'lucide-react';
import { getPersonDetail, requestMedia } from '../lib/api.js';

export default function Person() {
  const { id } = useParams();
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(null);
  const [showBio, setShowBio] = useState(false);

  useEffect(() => {
    setLoading(true);
    getPersonDetail(id)
      .then(setPerson)
      .catch(() => setPerson(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRequest = async (item) => {
    if (requesting === item.tmdbId) return;
    setRequesting(item.tmdbId);
    try {
      await requestMedia(item.tmdbId, item.type, item.title);
      // Mark as requested in local state
      setPerson(prev => ({
        ...prev,
        castCredits: prev.castCredits.map(c =>
          c.tmdbId === item.tmdbId ? { ...c, requested: true } : c
        ),
      }));
    } catch (err) {
      alert(`Request failed: ${err.message}`);
    } finally {
      setRequesting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-thea-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="pt-24 text-center">
        <p className="text-thea-muted text-lg">Person not found</p>
        <Link to="/" className="text-thea-accent hover:underline mt-4 inline-block">Go home</Link>
      </div>
    );
  }

  const age = person.birthday ? (() => {
    const birth = new Date(person.birthday);
    const end = person.deathday ? new Date(person.deathday) : new Date();
    return Math.floor((end - birth) / 31557600000);
  })() : null;

  return (
    <div className="pt-24 pb-12 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Back button */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-thea-muted hover:text-thea-text mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      {/* Person header */}
      <div className="flex gap-6 mb-8">
        {person.photo ? (
          <img src={person.photo} alt={person.name} className="w-36 h-48 object-cover rounded-xl shadow-lg flex-shrink-0" />
        ) : (
          <div className="w-36 h-48 rounded-xl bg-thea-card flex items-center justify-center flex-shrink-0">
            <Film className="w-12 h-12 text-thea-muted" />
          </div>
        )}

        <div className="min-w-0">
          <h1 className="text-3xl font-bold mb-2">{person.name}</h1>
          <div className="flex flex-wrap gap-3 text-sm text-thea-muted mb-3">
            {person.knownFor && (
              <span className="bg-thea-accent/10 text-thea-accent px-3 py-0.5 rounded-full text-xs">
                {person.knownFor}
              </span>
            )}
            {person.birthday && (
              <span>Born: {new Date(person.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            )}
            {age && <span>({age}{person.deathday ? ', deceased' : ''})</span>}
            {person.placeOfBirth && <span>{person.placeOfBirth}</span>}
          </div>

          {person.biography && (
            <div className="text-sm text-thea-muted leading-relaxed max-w-2xl">
              <p className={showBio ? '' : 'line-clamp-4'}>{person.biography}</p>
              {person.biography.length > 300 && (
                <button onClick={() => setShowBio(!showBio)} className="text-thea-accent text-xs mt-1 hover:underline">
                  {showBio ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filmography — Acting */}
      {person.castCredits?.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Film className="w-5 h-5 text-thea-accent" />
            Filmography ({person.castCredits.length})
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {person.castCredits.map(item => (
              <div key={`${item.type}-${item.tmdbId}`} className="bg-thea-card border border-thea-border rounded-xl overflow-hidden group hover:border-thea-accent/50 transition-colors">
                {/* Poster — clickable to detail page */}
                <Link to={`/${item.type}/${item.tmdbId}`}>
                  {item.poster ? (
                    <img src={item.poster} alt={item.title} className="w-full aspect-[2/3] object-cover" />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-thea-surface flex items-center justify-center">
                      <Film className="w-8 h-8 text-thea-muted" />
                    </div>
                  )}
                </Link>

                <div className="p-2.5">
                  <Link to={`/${item.type}/${item.tmdbId}`} className="hover:text-thea-accent transition-colors">
                    <p className="text-xs font-medium truncate">{item.title}</p>
                  </Link>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-thea-muted">{item.year || '?'}</span>
                    {item.rating > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-thea-gold">
                        <Star className="w-2.5 h-2.5 fill-thea-gold" /> {item.rating?.toFixed(1)}
                      </span>
                    )}
                  </div>
                  {item.character && (
                    <p className="text-[10px] text-thea-muted truncate mt-0.5">as {item.character}</p>
                  )}

                  {/* Watch / Request button */}
                  <div className="mt-2">
                    {item.inLibrary ? (
                      <Link to={`/${item.type}/${item.tmdbId}`}
                        className="flex items-center justify-center gap-1 w-full text-[10px] bg-thea-accent/10 text-thea-accent py-1.5 rounded-lg hover:bg-thea-accent/20 transition-colors">
                        <Play className="w-3 h-3" /> In Library
                      </Link>
                    ) : item.requested ? (
                      <div className="flex items-center justify-center gap-1 w-full text-[10px] bg-green-400/10 text-green-400 py-1.5 rounded-lg">
                        Requested!
                      </div>
                    ) : (
                      <button
                        onClick={() => handleRequest(item)}
                        disabled={requesting === item.tmdbId}
                        className="flex items-center justify-center gap-1 w-full text-[10px] bg-thea-gold/10 text-thea-gold py-1.5 rounded-lg hover:bg-thea-gold/20 transition-colors disabled:opacity-50">
                        <Plus className="w-3 h-3" /> {requesting === item.tmdbId ? '...' : 'Request'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filmography — Crew (Directed / Produced / Wrote) */}
      {person.crewCredits?.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-purple-400" />
            Also Worked On
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {person.crewCredits.map((item, i) => (
              <div key={`crew-${item.tmdbId}-${item.job}-${i}`} className="bg-thea-card border border-thea-border rounded-xl overflow-hidden hover:border-thea-accent/50 transition-colors">
                <Link to={`/${item.type}/${item.tmdbId}`}>
                  {item.poster ? (
                    <img src={item.poster} alt={item.title} className="w-full aspect-[2/3] object-cover" />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-thea-surface flex items-center justify-center">
                      <Film className="w-8 h-8 text-thea-muted" />
                    </div>
                  )}
                </Link>
                <div className="p-2.5">
                  <Link to={`/${item.type}/${item.tmdbId}`} className="hover:text-thea-accent transition-colors">
                    <p className="text-xs font-medium truncate">{item.title}</p>
                  </Link>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-thea-muted">{item.year || '?'}</span>
                    <span className="text-[10px] text-purple-400">{item.job}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
