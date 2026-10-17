import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { translate } from "../i18n/translate";
export type Language = "en" | "my";
export const useLanguage = create<{
  language: Language;
  hydrate: () => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
}>((set) => ({
  language: "my",
  hydrate: async () => {
    const value = await SecureStore.getItemAsync("socialrecipe.language").catch(
      () => null,
    );
    if (value === "en" || value === "my") set({ language: value });
  },
  setLanguage: async (language) => {
    await SecureStore.setItemAsync("socialrecipe.language", language);
    set({ language });
  },
}));
export function t<T>(value: T): T {
  return (
    typeof value === "string"
      ? translate(value, useLanguage.getState().language)
      : value
  ) as T;
}

export const dateLocale = () =>
  useLanguage.getState().language === "my" ? "my-MM" : "en-US";
