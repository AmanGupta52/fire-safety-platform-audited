import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, apiErrorMessage } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';
import { Product } from '../types';

export function useWishlist() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: wishlist } = useQuery({
    queryKey: ['wishlist'],
    queryFn: async () => (await api.get('/wishlist')).data.data as Product[],
    enabled: Boolean(accessToken)
  });

  const addMutation = useMutation({
    mutationFn: async (productId: string) => api.post('/wishlist', { productId }),
    onSuccess: () => { toast.success('Added to wishlist'); queryClient.invalidateQueries({ queryKey: ['wishlist'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const removeMutation = useMutation({
    mutationFn: async (productId: string) => api.delete(`/wishlist/${productId}`),
    onSuccess: () => { toast.success('Removed from wishlist'); queryClient.invalidateQueries({ queryKey: ['wishlist'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  function isWishlisted(productId: string) {
    return Boolean(wishlist?.some((p) => p._id === productId));
  }

  function toggleWishlist(productId: string) {
    if (!accessToken) {
      toast('Please sign in to save items', { icon: '🔒' });
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (isWishlisted(productId)) removeMutation.mutate(productId);
    else addMutation.mutate(productId);
  }

  return { wishlist: wishlist || [], isWishlisted, toggleWishlist, count: wishlist?.length || 0 };
}
