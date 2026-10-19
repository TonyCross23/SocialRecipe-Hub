import { useEffect, useState } from "react";
import { ArrowUpRight, Bell, Check, CheckCheck, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Button, Card } from "../components/ui";
import {
  notificationDestination,
  useNotificationActions,
  useNotifications,
  type NotificationFilter,
} from "../lib/notifications";
import { cn, formatNumber, titleCase } from "../lib/utils";
import { useAuthStore } from "../store/auth-store";
import { ErrorBox, Loading, PageTitle } from "./DashboardPage";

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const notifications = useNotifications(page, filter);
  const { markRead, markAllRead } = useNotificationActions();
  const permissions = useAuthStore((state) => state.user!.permissions);
  const data = notifications.data;
  const busy = markRead.isPending || markAllRead.isPending;
  const mutationError = markRead.error ?? markAllRead.error;

  useEffect(() => {
    if (data && page > Math.max(1, data.pagination.totalPages)) {
      setPage(Math.max(1, data.pagination.totalPages));
    }
  }, [data, page]);

  return (
    <>
      <PageTitle
        title="Notifications"
        description="Your reports, account appeals, and community updates in one place."
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex items-center gap-2"
          aria-label="Filter notifications"
        >
          {(["all", "unread"] as const).map((value) => (
            <Button
              key={value}
              variant={filter === value ? "primary" : "outline"}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
            >
              {value === "all" ? "All notifications" : "Unread"}
              {value === "unread" && data && (
                <span>({formatNumber(data.unreadCount)})</span>
              )}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void notifications.refetch()}
            disabled={notifications.isFetching}
          >
            <RefreshCw
              size={16}
              className={notifications.isFetching ? "animate-spin" : ""}
            />{" "}
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => markAllRead.mutate()}
            disabled={busy || !data?.unreadCount}
          >
            <CheckCheck size={17} /> Mark all read
          </Button>
        </div>
      </div>
      {mutationError && (
        <div className="mb-4" role="alert">
          <ErrorBox message={mutationError.message} />
        </div>
      )}
      {notifications.isLoading ? (
        <Loading />
      ) : notifications.error || !data ? (
        <ErrorBox message={notifications.error?.message} />
      ) : !data.data.length ? (
        <Card className="grid justify-items-center gap-3 px-6 py-16 text-center">
          <Bell size={30} className="text-stone-400" />
          <h3 className="text-lg font-bold">
            {filter === "unread"
              ? "You're all caught up"
              : "No notifications yet"}
          </h3>
          <p className="max-w-md text-sm text-stone-500 dark:text-stone-400">
            {filter === "unread"
              ? "New unread notifications will appear here."
              : "Notifications sent to your account will appear here as activity happens."}
          </p>
        </Card>
      ) : (
        <>
          <p
            className="mb-3 text-sm text-stone-500 dark:text-stone-400"
            role="status"
          >
            {formatNumber(data.pagination.total)}{" "}
            {filter === "unread" ? "unread notifications" : "notifications"}
          </p>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-stone-200 dark:divide-stone-800">
              {data.data.map((item) => {
                const destination = notificationDestination(
                  item.type,
                  permissions,
                );
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex gap-4 p-5 sm:p-6",
                      !item.readAt && "bg-emerald-50/60 dark:bg-emerald-950/30",
                    )}
                  >
                    <div className="mt-1 grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <Bell size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words font-semibold">
                          {item.title}
                        </h3>
                        {!item.readAt && <Badge tone="success">Unread</Badge>}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                        {item.message}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                        <span>{titleCase(item.type)}</span>
                        <time dateTime={item.createdAt}>
                          {new Date(item.createdAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </time>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {!item.readAt && (
                          <Button
                            variant="outline"
                            disabled={busy}
                            aria-label={`Mark ${item.title} as read`}
                            onClick={() => markRead.mutate(item.id)}
                          >
                            <Check size={16} /> Mark read
                          </Button>
                        )}
                        {destination && (
                          <Link
                            to={destination}
                            onClick={() => {
                              if (!item.readAt) markRead.mutate(item.id);
                            }}
                            className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-950"
                          >
                            {destination === "/appeals"
                              ? "View account appeals"
                              : "View reports"}
                            <ArrowUpRight size={16} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <nav
            className="mt-5 flex flex-wrap items-center justify-between gap-3"
            aria-label="Notification pages"
          >
            <span className="text-sm text-stone-500 dark:text-stone-400">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page === 1 || notifications.isFetching}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={
                  page >= data.pagination.totalPages || notifications.isFetching
                }
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </nav>
        </>
      )}
    </>
  );
}
