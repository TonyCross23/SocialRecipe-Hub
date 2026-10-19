import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "../store/theme-store";

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggle = useThemeStore((state) => state.toggle);
  const label =
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggle}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-stone-200 dark:hover:bg-stone-800"
    >
      {theme === "dark" ? <Sun size={21} /> : <Moon size={21} />}
    </button>
  );
}
