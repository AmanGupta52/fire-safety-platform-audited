import { useState } from 'react';
import { Bell, ChevronDown, LogOut, User, CheckCheck, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntity?: string;
  relatedEntityId?: string;
  createdAt: string;
}

// Where a notification can link through to, when the backend told us what it's about.
// Most notification types don't set relatedEntity at all — those just mark-as-read on click.
const RELATED_ENTITY_PATH: Record<string, string> = {
  AMCContract: '/amc'
};

export function Topbar({ title, onMenuClick }: { title?: string; onMenuClick?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: notifData } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: async () => (await api.get('/notifications')).data.data as { notifications: Notification[]; unreadCount: number },
    refetchInterval: 60_000
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-notifications'] })
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-notifications'] })
  });

  function openNotification(n: Notification) {
    if (!n.isRead) markReadMutation.mutate(n._id);
    const path = n.relatedEntity && RELATED_ENTITY_PATH[n.relatedEntity];
    if (path) { setNotifOpen(false); navigate(path); }
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-line bg-card px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onMenuClick}
          className="rounded p-2 text-slateink hover:bg-paper lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="page-heading truncate text-sm text-ink">{title}</p>
      </div>

      <div className="flex items-center gap-1 sm:gap-4">
        <div className="relative">
          <button
            onClick={() => { setNotifOpen((v) => !v); setMenuOpen(false); }}
            className="relative rounded p-2 text-slateink hover:bg-paper"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {Boolean(notifData?.unreadCount) && (
              <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-brand" />
            )}
          </button>

          {notifOpen && (
            <div className="fixed left-3 right-3 top-16 z-20 mt-1 rounded border border-line bg-white shadow-popover sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-80">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <p className="text-xs font-semibold text-ink">Notifications</p>
                {Boolean(notifData?.unreadCount) && (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    className="flex items-center gap-1 text-[11px] font-medium text-slateink hover:text-ink"
                  >
                    <CheckCheck className="h-3 w-3" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {!notifData?.notifications.length ? (
                  <p className="px-3 py-6 text-center text-xs text-slateink">No notifications yet</p>
                ) : (
                  notifData.notifications.map((n) => (
                    <button
                      key={n._id}
                      onClick={() => openNotification(n)}
                      className={clsx(
                        'flex w-full flex-col gap-0.5 border-b border-line px-3 py-2.5 text-left last:border-b-0 hover:bg-paper',
                        !n.isRead && 'bg-brand-light/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={clsx('text-xs', !n.isRead ? 'font-semibold text-ink' : 'font-medium text-slateink')}>{n.title}</p>
                        {!n.isRead && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                      </div>
                      <p className="text-[11px] text-slateink">{n.message}</p>
                      <p className="text-[10px] text-slateink/70">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => { setMenuOpen((v) => !v); setNotifOpen(false); }}
            className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-paper"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="hidden text-left sm:block">
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
