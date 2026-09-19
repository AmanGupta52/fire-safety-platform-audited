import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { api } from '../../lib/apiClient';
import { AppNotification } from '../../types';
import { Card, EmptyState, Spinner } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';

export default function MyNotifications() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-notifications-full'],
    queryFn: async () => (await api.get('/notifications')).data.data as { notifications: AppNotification[]; unreadCount: number }
  });

  const markAllMutation = useMutation({
    mutationFn: async () => api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-notifications-full'] })
  });

  const markOneMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-notifications-full'] })
  });

  if (isLoading) return <Spinner />;
  const notifications = data?.notifications || [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="heading text-xl text-ink">Notifications</h1>
        {Boolean(data?.unreadCount) && <Button variant="secondary" size="sm" onClick={() => markAllMutation.mutate()}>Mark all as read</Button>}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="Order updates, service reminders and AMC alerts will show up here." />
      ) : (
        <div className="mt-5 flex flex-col gap-2">
          {notifications.map((n) => (
            <Card key={n._id} className={clsx('cursor-pointer p-4', !n.isRead && 'border-l-4 border-l-brand')} onClick={() => !n.isRead && markOneMutation.mutate(n._id)}>
              <p className="text-sm font-medium text-ink">{n.title}</p>
              <p className="mt-0.5 text-sm text-slateink">{n.message}</p>
              <p className="mt-1.5 text-xs text-slateink">{format(new Date(n.createdAt), 'd MMM yyyy, h:mm a')}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
