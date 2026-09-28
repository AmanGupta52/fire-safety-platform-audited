import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/apiClient';
import { Service } from '../types';

export function useServices() {
  return useQuery({
    queryKey: ['services-catalog'],
    queryFn: async () => {
      const res = await api.get('/services/catalog');
      return res.data.data as Service[];
    },
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
}

export function useService(slug?: string) {
  return useQuery({
    queryKey: ['service-detail', slug],
    queryFn: async () => {
      if (!slug) throw new Error('Service slug is required');
      const res = await api.get(`/services/catalog/${slug}`);
      return res.data.data as Service;
    },
    enabled: Boolean(slug),
    staleTime: 2 * 60 * 1000
  });
}
