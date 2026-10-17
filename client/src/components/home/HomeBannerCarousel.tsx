import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner } from '../../types';

const DEFAULT_ROTATE_MS = 3000;

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

/**
 * Full-bleed rotating banner carousel for the homepage — replaces the old category-photo
 * showcase. Content comes entirely from the admin Banners page (Content > Banners), so
 * whoever manages the storefront controls what shows here without a code change: title,
 * photo, and where a click should go (linkUrl). Cross-fades to the next banner every 3s,
 * same as before; clicking a slide (but not the dot pagination) follows that banner's link —
 * an absolute http(s) URL opens in a new tab, anything else (e.g. "/products?category=x")
 * navigates within the site. A banner with no linkUrl set is just a photo, not a button.
 *
 * Skips itself entirely when there are no active banners, so the homepage doesn't show an
 * empty box before any banners are uploaded.
 */
export function HomeBannerCarousel({ banners, loading, intervalMs = DEFAULT_ROTATE_MS }: { banners?: Banner[]; loading?: boolean; intervalMs?: number }) {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  // Bumped when the visitor picks a slide by hand, which restarts the auto-advance countdown for that slide.
  const [restartTick, setRestartTick] = useState(0);

  const slides = (banners || []).filter((b) => b.image);
  const slideCount = slides.length;

  // Auto-advance. The interval only depends on primitives, so it is created once and is NOT recreated on every
  // render; the functional state update means it never reads a stale `active`; cleanup stops it on unmount.
  useEffect(() => {
    if (slideCount <= 1) return;
    const id = window.setInterval(() => setActive((prev) => (prev + 1) % slideCount), intervalMs);
    return () => window.clearInterval(id);
  }, [slideCount, intervalMs, restartTick]);

  // Reset to the first slide if the active index falls out of range (e.g. banner count shrinks).
  useEffect(() => {
    setActive((prev) => (prev >= slideCount ? 0 : prev));
  }, [slideCount]);

  if (loading || slides.length === 0) return null;

  const current = slides[active];
  const clickable = Boolean(current.linkUrl);

  function handleActivate() {
    const url = current.linkUrl;
    if (!url) return;
    if (isExternalUrl(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(url.startsWith('/') ? url : `/${url}`);
    }
  }

  function goTo(index: number, e: React.MouseEvent) {
    e.stopPropagation();
    setActive(index);
    setRestartTick((t) => t + 1);
  }

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handleActivate : undefined}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && handleActivate() : undefined}
      aria-label={clickable ? `Open ${current.title}` : current.title}
      className={`skeuo-bezel group relative h-64 w-full overflow-hidden rounded-xl outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-safety sm:h-80 lg:h-96 ${clickable ? 'cursor-pointer' : ''}`}
    >
      {slides.map((banner, index) => (
        <div
          key={banner._id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            index === active ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          {/* Blurred backdrop fills the space the contained photo leaves empty */}
          <img
            src={banner.image}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-50 saturate-150"
          />

          {/* Foreground photo, always shown in full, never cropped */}
          <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-10">
            <img
              src={banner.image}
              alt={banner.title}
              className={`h-full max-h-full w-auto rounded-md object-contain shadow-lg transition-transform duration-700 ${clickable ? 'group-hover:scale-105' : ''}`}
            />
          </div>

          {/* Legibility gradient + caption */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-inverse/85 via-inverse/15 to-transparent px-6 pb-5 pt-16">
            <p className="glass-dark heading inline-block max-w-full rounded-xl px-4 py-2 text-xl text-white sm:text-2xl">{banner.title}</p>
          </div>
        </div>
      ))}

      {slides.length > 1 && (
        <div className="glass-dark absolute right-4 top-4 z-10 flex gap-1.5 rounded-full px-2.5 py-2">
          {slides.map((banner, index) => (
            <button
              key={banner._id}
              onClick={(e) => goTo(index, e)}
              aria-label={`Show ${banner.title}`}
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
