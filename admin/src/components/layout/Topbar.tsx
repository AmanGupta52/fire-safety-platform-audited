import { useState } from 'react';
import { Bell, ChevronDown, LogOut, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { useNavigate } from 'react-router-dom';

export function Topbar({ title }: { title?: string }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: notifData } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: async () => (await api.get('/notifications')).data.data as { unreadCount: number },
    refetchInterval: 60_000
  });

  return (
    <header className="flex h-16 items-center justify-between border-b border-line bg-card px-6">
      <p className="page-heading text-sm text-ink">{title}</p>

      <div className="flex items-center gap-4">
        <button className="relative rounded p-2 text-slateink hover:bg-paper" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {Boolean(notifData?.unreadCount) && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-brand" />
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-paper"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-ink">{user?.name}</p>
              <p className="text-[10px] capitalize text-slateink">{user?.role.replace('_', ' ')}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slateink" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded border border-line bg-white py-1 shadow-popover">
              <button
                onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-paper"
              >
                <User className="h-3.5 w-3.5" /> Account settings
              </button>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-brand hover:bg-brand-light"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
