import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { FlameKindling } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { NAV_GROUPS, canAccessNavItem } from '../../lib/navConfig';
import { preloadRoute } from '../../routes/lazyPages';

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const user = useAuthStore((s) => s.user);

  return (
    <>
      {/* Backdrop — only exists while the mobile drawer is open */}
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} aria-hidden="true" />}
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-40 flex h-dvh w-60 flex-col bg-inverse text-white/90 transition-transform duration-200 dark:border-r dark:border-line',
        'lg:static lg:z-auto lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-brand">
          <FlameKindling className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="page-heading text-sm leading-tight text-white">Fire Safety</p>
          <p className="text-[10px] leading-tight text-white/50">Admin Console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => canAccessNavItem(item, user, hasPermission));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-wide text-white/35">{group.label}</p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onClose}
                    onMouseEnter={() => preloadRoute(item.to)}
                    onFocus={() => preloadRoute(item.to)}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] font-medium transition-colors',
                        isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
    </>
  );
}
