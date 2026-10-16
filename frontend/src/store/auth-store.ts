import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResponse, User } from '../lib/types';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setAuth: (auth: AuthResponse) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(persist((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  setAuth: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
  setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
  clear: () => set({ accessToken: null, refreshToken: null, user: null }),
}), {
  name: 'socialrecipe-admin-auth',
  partialize: (state) => ({
    accessToken: null,
    refreshToken: state.refreshToken,
    user: state.user,
    setAuth: state.setAuth,
    setTokens: state.setTokens,
    clear: state.clear,
  }),
}));
