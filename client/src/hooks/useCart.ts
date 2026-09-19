import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, apiErrorMessage } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';
import { CartSummary } from '../types';

export function useCart() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: async () => (await api.get('/cart')).data.data as CartSummary,
    enabled: Boolean(accessToken)
  });

  function requireLogin(): boolean {
    if (!accessToken) {
      toast('Please sign in to continue', { icon: '🔒' });
      navigate('/login', { state: { from: location.pathname } });
      return false;
    }
    return true;
  }

  const addMutation = useMutation({
    mutationFn: async (vars: { productId: string; quantity: number }) => api.post('/cart/items', vars),
    onSuccess: () => { toast.success('Added to cart'); queryClient.invalidateQueries({ queryKey: ['cart'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: { productId: string; quantity: number }) => api.put(`/cart/items/${vars.productId}`, { quantity: vars.quantity }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const removeMutation = useMutation({
    mutationFn: async (productId: string) => api.delete(`/cart/items/${productId}`),
    onSuccess: () => { toast.success('Removed from cart'); queryClient.invalidateQueries({ queryKey: ['cart'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const applyCouponMutation = useMutation({
    mutationFn: async (code: string) => api.post('/cart/coupon', { code }),
    onSuccess: () => { toast.success('Coupon applied'); queryClient.invalidateQueries({ queryKey: ['cart'] }); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return {
    cart, isLoading,
    itemCount: cart?.items.reduce((sum, i) => sum + i.quantity, 0) || 0,
    addToCart: (vars: { productId: string; quantity: number }) => { if (requireLogin()) addMutation.mutate(vars); },
    updateQuantity: updateMutation.mutate,
    removeItem: removeMutation.mutate,
    applyCoupon: applyCouponMutation.mutate,
    isAdding: addMutation.isPending,
    isApplyingCoupon: applyCouponMutation.isPending
  };
}
