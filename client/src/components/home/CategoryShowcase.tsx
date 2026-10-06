import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Category } from '../../types';

const DEFAULT_ROTATE_MS = 3000;

/**
 * Full-bleed rotating category photo showcase — this is the site's single "shop by category"
 * entry point. Each slide shows one category's photo in full (object-contain, never cropped)
 * with a blurred, saturated copy of the same photo filling the space around it, cross-fading
 * to the next category on a timer. Clicking the panel (but not the dot pagination) goes to
 * the catalog filtered to that category.
 *
 * Skips itself entirely when fewer than one category has a photo, so the page doesn't show
 * an empty box before category images are uploaded.
 */
export function CategoryShowcase({ categories, loading, intervalMs = DEFAULT_ROTATE_MS }: { categories?: Category[]; loading?: boolean; intervalMs?: number }) {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const timerRef = useRef<number | undefined>(undefined);

  const slides = (categories || []).filter((c) => c.image);

  const startTimer = () => {
    window.clearInterval(timerRef.current);
    if (slides.length > 1) {
      timerRef.current = window.setInterval(() => {
        setActive((prev) => (prev + 1) % slides.length);
      }, intervalMs);
    }
  };

  useEffect(() => {
    startTimer();
    return () => window.clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, intervalMs]);

  if (loading || slides.length === 0) return null;

  function goTo(index: number, e: React.MouseEvent) {
    e.stopPropagation();
    setActive(index);
    startTimer();
  }

  // Bare panel only — no wrapping <section> or heading, so the calling page controls the
  // surrounding layout/heading and this component can't end up nested inside a duplicate one.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/products?category=${slides[active].slug}`)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/products?category=${slides[active].slug}`)}
      aria-label={`Browse ${slides[active].name}`}
      className="group relative h-64 w-full cursor-pointer overflow-hidden rounded-card border border-line shadow-card outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-safety sm:h-80 lg:h-96"
    >
      {slides.map((cat, index) => (
        <div
          key={cat._id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            index === active ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          {/* Blurred backdrop fills the space the contained photo leaves empty */}
          <img
            src={cat.image}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-50 saturate-150"
          />

          {/* Foreground photo, always shown in full, never cropped */}
          <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-10">
            <img
              src={cat.image}
              alt={cat.name}
              className="h-full max-h-full w-auto rounded-md object-contain shadow-lg transition-transform duration-700 group-hover:scale-105"
            />
          </div>

          {/* Legibility gradient + caption */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-inverse/85 via-inverse/15 to-transparent px-6 pb-5 pt-16">
            <p className="heading text-xl text-white sm:text-2xl">{cat.name}</p>
            <p className="text-xs text-white/70 sm:text-sm">Explore the collection →</p>
          </div>
        </div>
      ))}

      {slides.length > 1 && (
        <div className="absolute right-4 top-4 z-10 flex gap-1.5">
          {slides.map((cat, index) => (
            <button
              key={cat._id}
              onClick={(e) => goTo(index, e)}
              aria-label={`Show ${cat.name}`}
              className={`h-2 rounded-full transition-all ${
                index === active ? 'w-5 bg-amber' : 'w-2 bg-white/60 hover:bg-white'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
