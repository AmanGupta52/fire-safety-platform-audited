import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { Category } from '../../types';
import { ImageWithFallback } from '../ui/ImageWithFallback';
import { Reveal } from '../ui/Reveal';

/**
 * A single scrollable row of circular category avatars with their name underneath — sits
 * below the main CategoryShowcase banner as a quick, all-categories-at-a-glance way to jump
 * into the catalog. Scrolls natively (touch/trackpad), with left/right arrow buttons for
 * mouse users; the arrows only render once there's actually more content in that direction,
 * and re-check on every scroll so they disable themselves correctly at either end.
 */
export function CategoryCircles({ categories }: { categories?: Category[] }) {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const items = categories || [];

  function updateArrows() {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateArrows();
    window.addEventListener('resize', updateArrows);
    return () => window.removeEventListener('resize', updateArrows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  function scroll(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.min(el.clientWidth * 0.8, 480), behavior: 'smooth' });
  }

  if (items.length === 0) return null;

  return (
    <div className="relative">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Scroll categories left"
          className="absolute left-0 top-9 z-10 hidden -translate-x-3 items-center justify-center rounded-full border border-line bg-white p-2 text-ink shadow-card transition-transform hover:scale-105 active:scale-95 sm:flex sm:top-11"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      <div
        ref={scrollerRef}
        onScroll={updateArrows}
        className="no-scrollbar flex gap-5 overflow-x-auto scroll-smooth px-1 pb-1"
      >
        {items.map((cat, i) => (
          <Reveal key={cat._id} delay={Math.min(i * 0.04, 0.3)} y={10} className="shrink-0">
            <button
              type="button"
              onClick={() => navigate(`/products?category=${cat.slug}`)}
              className="group flex w-20 flex-col items-center gap-2 sm:w-24"
            >
              <ImageWithFallback
                src={cat.image}
                alt={cat.name}
                className="h-20 w-20 rounded-full border border-line shadow-card transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-lift sm:h-24 sm:w-24"
                imgClassName="object-cover"
                fallbackIcon={LayoutGrid}
                fallbackLabel=""
              />
              <span className="line-clamp-2 text-center text-xs font-medium leading-snug text-ink">{cat.name}</span>
            </button>
          </Reveal>
        ))}
      </div>

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="Scroll categories right"
          className="absolute right-0 top-9 z-10 hidden translate-x-3 items-center justify-center rounded-full border border-line bg-white p-2 text-ink shadow-card transition-transform hover:scale-105 active:scale-95 sm:flex sm:top-11"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
