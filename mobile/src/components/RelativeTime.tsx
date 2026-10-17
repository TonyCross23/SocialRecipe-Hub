import { t, useLanguage } from "../store/language";
import { useSyncExternalStore } from "react";
import { Text, type TextProps } from "react-native";
import { relativeTime } from "../lib/time";
let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const notify of listeners) notify();
    }, 30000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
const snapshot = () => now;
export function RelativeTime({
  value,
  ...props
}: { value: string } & TextProps) {
  useLanguage((s) => s.language);
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  const date = new Date(value);
  return (
    <Text
      {...props}
      accessibilityLabel={
        Number.isFinite(date.getTime()) ? date.toLocaleString() : t("Recently")
      }
    >
      {t(relativeTime(value, current))}
    </Text>
  );
}
