import { useQuery } from "@tanstack/react-query";
import { FileWarning, MessageCircle, Newspaper, Users } from "lucide-react";
import { Card } from "../components/ui";
import { api } from "../lib/api";
import { formatNumber, titleCase } from "../lib/utils";

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
            <div className="flex items-center justify-between text-sm font-semibold text-stone-500">
              {label}
              <Icon size={19} className="text-emerald-700" />
            </div>
            <p className="mt-5 text-3xl font-bold">{formatNumber(value)}</p>
            <p className="mt-1 text-sm text-stone-500">{note}</p>
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Breakdown title="Content status" rows={data.postsByStatus} />
        <Breakdown title="Report workflow" rows={data.reportsByStatus} />
      </div>
    </>
  );
}
function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { status: string; count: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card className="p-6">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-5 grid gap-4">
        {rows.map((row) => (
          <div key={row.status}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{titleCase(row.status)}</span>
              <strong>{row.count}</strong>
            </div>
            <div className="h-2 rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-emerald-600"
                style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
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
    <p className="mt-1 text-sm text-stone-500">{description}</p>
  </div>
);
export const Loading = () => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: 4 }, (_, i) => (
      <div key={i} className="h-36 animate-pulse rounded-2xl bg-stone-200" />
    ))}
  </div>
);
export const ErrorBox = ({ message }: { message?: string }) => (
  <Card className="p-6 text-red-700">
    {message ?? "Unable to load this page."}
  </Card>
);
