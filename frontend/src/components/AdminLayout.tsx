import {
  Bell,
  Bot,
  ChartNoAxesCombined,
  FileWarning,
  Gauge,
  LogOut,
  Settings2,
  Users,
} from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "../lib/api";
import {
  notificationDestination,
  useNotificationActions,
  useNotifications,
} from "../lib/notifications";
import { cn } from "../lib/utils";
import { useAuthStore } from "../store/auth-store";
import { PermissionGate } from "./ProtectedRoute";
import { Button } from "./ui";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { to: "/dashboard", label: "Overview", icon: Gauge },
  { to: "/notifications", label: "Notifications", icon: Bell },
  {
    to: "/appeals",
    label: "Account appeals",
    icon: FileWarning,
    permission: "user:ban",
  },
  { to: "/users", label: "Users", icon: Users },
  {
    to: "/reports",
    label: "Reports",
    icon: FileWarning,
    permission: "moderation:review",
  },
  {
    to: "/audit-logs",
    label: "AI audit logs",
    icon: Bot,
    permission: "moderation:review",
  },
  {
    to: "/policies",
    label: "Policies",
    icon: Settings2,
    permission: "policy:manage",
  },
  { to: "/monitoring", label: "Monitoring", icon: ChartNoAxesCombined },
];

export function AdminLayout() {
  const user = useAuthStore((s) => s.user)!;
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifications = useNotifications(1, "all", 10);
  const { markRead, markAllRead } = useNotificationActions();
  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST", body: "{}" });
    } finally {
      clear();
      navigate("/login");
    }
  };
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-r border-stone-200 dark:border-stone-800 bg-[#123d31] p-5 text-white lg:min-h-screen">
        <div className="mb-10 flex items-center gap-3 text-lg font-bold">
          <span className="grid size-9 place-items-center rounded-xl rounded-bl-sm bg-lime-300 text-emerald-950">
            S
          </span>
          SocialRecipe
        </div>
        <nav className="grid gap-1">
          {links.map(({ to, label, icon: Icon, permission }) => {
            const item = (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-emerald-50/70 hover:bg-white/10 hover:text-white",
                    isActive && "bg-white/15 text-white",
                  )
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            );
            return permission ? (
              <PermissionGate key={to} permission={permission}>
                {item}
              </PermissionGate>
            ) : (
              item
            );
          })}
        </nav>
        <div className="mt-10 border-t border-white/10 pt-5">
          <p className="font-semibold">{user.name}</p>
          <p className="text-sm text-emerald-100/60">{user.role}</p>
          <Button
            variant="ghost"
            className="mt-3 text-white hover:bg-white/10"
            onClick={logout}
          >
            <LogOut size={16} />
            Sign out
          </Button>
        </div>
      </aside>
      <main className="min-w-0">
        <header className="flex h-20 items-center justify-between border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-5 lg:px-8">
          <div>
            <p className="text-xs font-bold tracking-[.18em] text-emerald-700 dark:text-emerald-400">
              COMMUNITY OPERATIONS
            </p>
            <h1 className="text-xl font-bold">Admin workspace</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="relative">
              <button
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                className="relative rounded-xl p-2 hover:bg-stone-100 dark:hover:bg-stone-800"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={21} />
                {Boolean(notifications.data?.unreadCount) && (
                  <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {notifications.data?.unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-12 z-40 w-80 overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 p-4">
                    <strong>Notifications</strong>
                    <button
                      className="text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                      disabled={
                        !notifications.data?.unreadCount ||
                        markAllRead.isPending
                      }
                      onClick={() => markAllRead.mutate()}
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.isLoading ? (
                      <p className="p-5 text-sm text-stone-500 dark:text-stone-400">
                        Loading notifications…
                      </p>
                    ) : notifications.error ? (
                      <p
                        className="p-5 text-sm text-red-700 dark:text-red-300"
                        role="alert"
                      >
                        Unable to load notifications. Open the notifications
                        page to retry.
                      </p>
                    ) : notifications.data?.data.length ? (
                      notifications.data.data.map((item) => (
                        <button
                          key={item.id}
                          className={cn(
                            "block w-full border-b border-stone-100 dark:border-stone-800 p-4 text-left hover:bg-stone-50 dark:hover:bg-stone-950",
                            !item.readAt && "bg-emerald-50 dark:bg-emerald-950",
                          )}
                          onClick={() => {
                            if (!item.readAt) markRead.mutate(item.id);
                            setNotificationsOpen(false);
                            navigate(
                              notificationDestination(
                                item.type,
                                user.permissions,
                              ) ?? "/notifications",
                            );
                          }}
                        >
                          <strong className="block text-sm">
                            {item.title}
                          </strong>
                          <span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">
                            {item.message}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="p-5 text-center text-sm text-stone-500 dark:text-stone-400">
                        You are all caught up.
                      </p>
                    )}
                  </div>
                  <Link
                    to="/notifications"
                    onClick={() => setNotificationsOpen(false)}
                    className="block border-t border-stone-200 p-4 text-center text-sm font-semibold text-emerald-700 hover:bg-stone-50 dark:border-stone-800 dark:text-emerald-300 dark:hover:bg-stone-800"
                  >
                    View all notifications
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="p-5 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
