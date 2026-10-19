import { create } from "zustand";

type Theme = "light" | "dark";
const storageKey = "socialrecipe-admin-theme";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Theme switching still works when browser storage is unavailable.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

const theme = initialTheme();
applyTheme(theme);

export const useThemeStore = create<{
  theme: Theme;
  toggle: () => void;
}>((set, get) => ({
  theme,
  toggle: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    set({ theme: next });
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Keep the selected theme for this session.
    }
  },
}));
