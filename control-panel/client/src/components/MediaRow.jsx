import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MediaCard from './MediaCard.jsx';

export default function MediaRow({ title, items = [], onRequest }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.offsetWidth * 0.75;
    scrollRef.current.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' });
  };

  if (!items.length) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-3 px-4 sm:px-6">{title}</h2>
      <div className="media-row-wrapper relative group">
        {/* Scroll buttons */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-r from-thea-bg to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-thea-bg to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>

        <div ref={scrollRef} className="media-row flex gap-3 px-4 sm:px-6 overflow-x-auto pb-2">
          {items.map((item, i) => (
            <MediaCard key={item.tmdbId || item.ratingKey || i} item={item} onRequest={onRequest} />
          ))}
        </div>
      </div>
    </section>
  );
}
