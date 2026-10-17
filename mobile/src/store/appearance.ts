import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
export type AppearanceMode = "system" | "light" | "dark";
export const useAppearance = create<{
  mode: AppearanceMode;
  hydrate: () => Promise<void>;
  setMode: (mode: AppearanceMode) => Promise<void>;
}>((set) => ({
  mode: "system",
  hydrate: async () => {
    try {
      const saved = await SecureStore.getItemAsync("socialrecipe.appearance");
      if (saved === "light" || saved === "dark" || saved === "system")
        set({ mode: saved });
    } catch {
      /* Fall back to the device preference. */
    }
  },
  setMode: async (mode) => {
    await SecureStore.setItemAsync("socialrecipe.appearance", mode);
    set({ mode });
  },
}));
