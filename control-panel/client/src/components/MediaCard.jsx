import { Link } from 'react-router-dom';
import { Play, Plus, Check, Star } from 'lucide-react';

export default function MediaCard({ item, onRequest }) {
  const detailUrl = `/${item.type}/${item.tmdbId || item.ratingKey}`;

  return (
    <Link
      to={detailUrl}
      className="media-card group relative flex-shrink-0 w-[160px] sm:w-[180px] rounded-xl overflow-hidden bg-thea-card border border-thea-border/50 hover:border-thea-accent/30 transition-all duration-300"
    >
      {/* Poster */}
      <div className="aspect-[2/3] relative overflow-hidden">
        {item.poster || item.thumb ? (
          <img
            src={item.poster || item.thumb}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-thea-surface flex items-center justify-center">
            <span className="text-thea-muted text-xs">No Poster</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-3 left-3 right-3 flex gap-2">
            {item.inLibrary ? (
              <button className="flex-1 flex items-center justify-center gap-1.5 bg-thea-accent hover:bg-thea-accent-hover text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors">
                <Play className="w-3.5 h-3.5" /> Watch
              </button>
            ) : (
              <button
                onClick={(e) => { e.preventDefault(); onRequest?.(item); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-thea-gold hover:bg-amber-400 text-black text-xs font-medium py-2 px-3 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Request
              </button>
            )}
          </div>
        </div>

        {/* Library badge */}
        {item.inLibrary && (
          <div className="absolute top-2 right-2 bg-green-500/90 backdrop-blur-sm rounded-full p-1">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Rating badge */}
        {item.rating > 0 && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5">
            <Star className="w-3 h-3 text-thea-gold fill-thea-gold" />
            <span className="text-[10px] font-medium text-white">{item.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <h3 className="text-sm font-medium text-thea-text truncate">{item.title}</h3>
        <div className="flex items-center gap-2 mt-1">
          {item.year && <span className="text-xs text-thea-muted">{item.year}</span>}
          <span className="text-xs text-thea-muted capitalize">{item.type}</span>
        </div>
      </div>
    </Link>
  );
}
