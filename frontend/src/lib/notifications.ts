import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Notification, Page } from "./types";

export type NotificationFilter = "all" | "unread";
export type NotificationPage = Page<Notification> & { unreadCount: number };

export function useNotifications(
  page = 1,
  filter: NotificationFilter = "all",
  limit = 20,
) {
  return useQuery({
    queryKey: ["notifications", page, filter, limit],
    queryFn: () =>
      api<NotificationPage>(
        `/admin/notifications?page=${page}&limit=${limit}&filter=${filter}`,
      ),
    refetchInterval: 20_000,
  });
}

export function useNotificationActions() {
  const client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["notifications"] });
  const markRead = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: refresh,
  });
  const markAllRead = useMutation({
    mutationFn: () => api("/admin/notifications/read-all", { method: "PATCH" }),
    onSuccess: refresh,
  });
  return { markRead, markAllRead };
}

export function notificationDestination(type: string, permissions: string[]) {
  if (type === "BAN_APPEAL" && permissions.includes("user:ban"))
    return "/appeals";
  if (type === "NEW_REPORT" && permissions.includes("moderation:review"))
    return "/reports";
  return null;
}
