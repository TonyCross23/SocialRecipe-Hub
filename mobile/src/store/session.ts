import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { Session, Tokens, User } from "../api/types";

const key = "socialrecipe.refresh-token";
// Only the refresh token is persisted. Profiles and access tokens live in memory.
interface SessionState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  ready: boolean;
  revision: number;
  hydrate: () => Promise<void>;
  signIn: (session: Session) => Promise<void>;
  rotate: (tokens: Tokens, revision: number) => Promise<void>;
  setUser: (user: User) => void;
  clear: () => Promise<void>;
}
// Serialize secure-storage writes so a late refresh cannot restore a logged-out session.
let writes = Promise.resolve();
function persist(token: string | null) {
  writes = writes
    .catch(() => {})
    .then(() =>
      token
        ? SecureStore.setItemAsync(key, token)
        : SecureStore.deleteItemAsync(key),
    );
  return writes;
}
export const useSession = create<SessionState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  ready: false,
  revision: 0,
  hydrate: async () => {
    try {
      set({ refreshToken: await SecureStore.getItemAsync(key) });
    } finally {
      set({ ready: true });
    }
  },
  signIn: async (session) => {
    await persist(session.refreshToken);
    set({ ...session, revision: get().revision + 1 });
  },
  rotate: async (tokens, revision) => {
    if (get().revision !== revision)
      throw new Error("Session changed. Please sign in again.");
    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    await persist(tokens.refreshToken);
    if (get().revision !== revision)
      throw new Error("Session changed. Please sign in again.");
  },
  setUser: (user) => set({ user }),
  clear: async () => {
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      revision: get().revision + 1,
    });
    await persist(null);
  },
}));
