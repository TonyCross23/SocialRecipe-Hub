import { useEffect } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "../store/session";
import { connectPush, pushEnabled, pushSupported } from "../lib/push";
export function PushRegistration({
  onOpen,
}: {
  onOpen: (data: unknown) => void;
}) {
  const revision = useSession((s) => s.revision);
  const client = useQueryClient();
  useEffect(() => {
    if (!pushSupported) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const reconnect = async () => {
      if ((await pushEnabled()) && !disposed)
        await connectPush().catch(() => undefined);
    };
    void reconnect();
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") void reconnect();
    });
    void import("expo-notifications")
      .then(async (Notifications) => {
        if (disposed) return;
        // In-app banners already display foreground updates, avoiding duplicate banners.
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: true,
          }),
        });
        const response = Notifications.addNotificationResponseReceivedListener(
          (item) => {
            if (!disposed) onOpen(item.notification.request.content.data);
          },
        );
        const received = Notifications.addNotificationReceivedListener(() => {
          void client.invalidateQueries({ queryKey: ["notifications"] });
          void client.invalidateQueries({ queryKey: ["notificationSummary"] });
        });
        cleanup = () => {
          response.remove();
          received.remove();
        };
        const initial = await Notifications.getLastNotificationResponseAsync();
        if (initial && !disposed) {
          onOpen(initial.notification.request.content.data);
          await Notifications.clearLastNotificationResponseAsync();
        }
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      foreground.remove();
      cleanup?.();
    };
  }, [revision, client, onOpen]);
  return null;
}
