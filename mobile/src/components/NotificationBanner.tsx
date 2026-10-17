import { notificationMessage } from "../i18n/translate";
import { t, useLanguage } from "../store/language";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import type { AppNotification } from "../api/types";
import { useNotificationSummary } from "../hooks/useCommunity";
import { useUI } from "./ui";
export function NotificationBanner({ onOpen }: { onOpen: () => void }) {
  const { styles, colors } = useUI();
  const language = useLanguage((s) => s.language);
  const query = useNotificationSummary();
  const client = useQueryClient();
  const insets = useSafeAreaInsets();
  const last = useRef<number | undefined>(undefined);
  const [item, setItem] = useState<AppNotification | null>(null);
  useEffect(() => {
    if (!query.data) return;
    const next = query.data.latestNotification
      ? Date.parse(query.data.latestNotification.createdAt)
      : 0;
    if (last.current !== undefined && next > last.current) {
      setItem(query.data.latestNotification);
      void client.invalidateQueries({ queryKey: ["notifications"] });
    }
    last.current = Math.max(last.current ?? 0, next);
  }, [query.data, client]);
  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(() => setItem(null), 6000);
    return () => clearTimeout(timer);
  }, [item]);
  if (!item) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        top: insets.top + 58,
        left: 12,
        right: 12,
        zIndex: 10,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setItem(null);
          onOpen();
        }}
        style={[styles.row, { flex: 1 }]}
      >
        <Ionicons name="notifications" color={colors.brand} size={19} />
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={2}
            style={{ color: colors.ink, fontSize: 13, lineHeight: 18 }}
          >
            {notificationMessage(item, language)}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Dismiss notification")}
        onPress={() => setItem(null)}
        style={{
          minWidth: 36,
          minHeight: 36,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="close" color={colors.muted} size={18} />
      </Pressable>
    </View>
  );
}
