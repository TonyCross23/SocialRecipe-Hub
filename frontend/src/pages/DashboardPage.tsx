import { useQuery } from "@tanstack/react-query";
import { FileWarning, MessageCircle, Newspaper, Users } from "lucide-react";
import { Card } from "../components/ui";
import { StatusChart } from "../components/StatusChart";
import { api } from "../lib/api";
import { formatNumber } from "../lib/utils";

type Dashboard = {
  totals: Record<
    "users" | "posts" | "comments" | "likes" | "follows" | "reports",
    number
  >;
  recent: { usersLast7Days: number; postsLast7Days: number };
  postsByStatus: { status: string; count: number }[];
  reportsByStatus: { status: string; count: number }[];
  usersByRole: { role: string; count: number }[];
};
export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/admin/dashboard"),
    refetchInterval: 30_000,
  });
  if (isLoading) return <Loading />;
  if (!data || error) return <ErrorBox message={error?.message} />;
  const cards = [
    {
      label: "Users",
      value: data.totals.users,
      note: `+${data.recent.usersLast7Days} this week`,
      icon: Users,
    },
    {
      label: "Posts",
      value: data.totals.posts,
      note: `+${data.recent.postsLast7Days} this week`,
      icon: Newspaper,
    },
    {
      label: "Comments",
      value: data.totals.comments,
      note: "Community conversations",
      icon: MessageCircle,
    },
    {
      label: "Reports",
      value: data.totals.reports,
      note: "Submitted for review",
      icon: FileWarning,
    },
  ];
  return (
    <>
      <PageTitle
        title="Overview"
        description="Community health and moderation signals at a glance."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, note, icon: Icon }) => (
          <Card key={label} className="p-5">
            <div className="flex items-center justify-between text-sm font-semibold text-stone-500 dark:text-stone-400">
              {label}
              <Icon
                size={19}
                className="text-emerald-700 dark:text-emerald-400"
              />
            </div>
            <p className="mt-5 text-3xl font-bold">{formatNumber(value)}</p>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {note}
            </p>
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <StatusChart
          title="Content status"
          description="Posts grouped by their current status."
          unit="posts"
          rows={data.postsByStatus}
          categories={[
            { status: "PUBLISHED", color: "#10b981" },
            { status: "FLAGGED", color: "#f59e0b" },
            { status: "BANNED", color: "#f87171" },
            { status: "DELETED", color: "#94a3b8" },
          ]}
        />
        <StatusChart
          title="Report workflow"
          description="How community reports have been handled."
          unit="reports"
          rows={data.reportsByStatus}
          categories={[
            { status: "PENDING", color: "#f59e0b" },
            { status: "REVIEWED", color: "#60a5fa" },
            { status: "DISMISSED", color: "#a78bfa" },
            { status: "ACTIONED", color: "#10b981" },
          ]}
        />
      </div>
    </>
  );
}
export const PageTitle = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="mb-6">
    <h2 className="text-2xl font-bold">{title}</h2>
    <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
      {description}
    </p>
  </div>
);
export const Loading = () => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: 4 }, (_, i) => (
      <div
        key={i}
        className="h-36 animate-pulse rounded-2xl bg-stone-200 dark:bg-stone-800"
      />
    ))}
  </div>
);
export const ErrorBox = ({ message }: { message?: string }) => (
  <Card className="p-6 text-red-700 dark:text-red-300">
    {message ?? "Unable to load this page."}
  </Card>
);
