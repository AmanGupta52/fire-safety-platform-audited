import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Permission, Role } from '../types';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  hasPermission: (perm: Permission) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
      hasPermission: (perm) => {
        const user = get().user;
        if (!user) return false;
        if (user.role === 'super_admin') return true;
        return user.permissions.includes(perm);
      }
    }),
    { name: 'fire-safety-admin-auth' }
  )
);

// Keep every open tab on the same tokens. Refresh tokens rotate (each one works once), so a second tab that kept
// using the old token after the first tab refreshed would be rejected and signed out. When another tab writes
// the stored session, this tab reloads it.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'fire-safety-admin-auth') void useAuthStore.persist.rehydrate();
  });
}
