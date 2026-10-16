import { useQuery } from "@tanstack/react-query";
import { Activity, Clock3, Gauge, Server } from "lucide-react";
import { Badge, Card } from "../components/ui";
import { api } from "../lib/api";
import { ErrorBox, Loading, PageTitle } from "./DashboardPage";

type Snapshot = {
  status: string;
  uptimeSeconds: number;
  activeRequests: number;
  totalRequests: number;
  errorRatePercent: number;
  averageLatencyMs: number;
  memory: { rssBytes: number; heapUsedBytes: number; heapTotalBytes: number };
  timeline: {
    timestamp: string;
    requests: number;
    errors: number;
    averageLatencyMs: number;
  }[];
};
const bytes = (v: number) => `${(v / 1024 / 1024).toFixed(1)} MB`;
export function MonitoringPage() {
  const snapshot = useQuery({
    queryKey: ["monitoring"],
    queryFn: () => api<Snapshot>("/admin/monitoring"),
    refetchInterval: 10_000,
  });
  if (snapshot.isLoading) return <Loading />;
  if (!snapshot.data || snapshot.error)
    return <ErrorBox message={snapshot.error?.message} />;
  const d = snapshot.data;
  const max = Math.max(1, ...d.timeline.map((p) => p.requests));
  const cards = [
    {
      label: "API status",
      value: d.status,
      note: `${Math.floor(d.uptimeSeconds / 3600)}h uptime`,
      icon: Activity,
    },
    {
      label: "Requests",
      value: d.totalRequests,
      note: `${d.activeRequests} active`,
      icon: Server,
    },
    {
      label: "Average latency",
      value: `${d.averageLatencyMs} ms`,
      note: "Current process",
      icon: Clock3,
    },
    {
      label: "Error rate",
      value: `${d.errorRatePercent}%`,
      note: "HTTP 5xx responses",
      icon: Gauge,
    },
  ];
  return (
    <>
      <PageTitle
        title="Monitoring"
        description="Live API traffic, latency, error rate, and runtime memory."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, note, icon: Icon }) => (
          <Card className="p-5" key={label}>
            <div className="flex justify-between text-sm text-stone-500">
              {label}
              <Icon size={18} />
            </div>
            <p className="mt-4 text-2xl font-bold capitalize">{value}</p>
            <p className="mt-1 text-sm text-stone-500">{note}</p>
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <div className="flex justify-between">
            <h3 className="font-bold">Requests over time</h3>
            <Badge tone="success">Live</Badge>
          </div>
          <div className="mt-8 flex h-52 items-end gap-2">
            {d.timeline.map((point) => (
              <div
                key={point.timestamp}
                className="flex h-full flex-1 flex-col justify-end gap-2"
              >
                <div
                  className="min-h-1 rounded-t-md bg-emerald-600"
                  style={{
                    height: `${Math.max(3, (point.requests / max) * 100)}%`,
                  }}
                  title={`${point.requests} requests`}
                />
                <small className="truncate text-center text-[10px] text-stone-400">
                  {new Date(point.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-bold">Runtime health</h3>
          <dl className="mt-5 grid gap-5 text-sm">
            <div>
              <dt className="text-stone-500">Resident memory</dt>
              <dd className="font-bold">{bytes(d.memory.rssBytes)}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Heap usage</dt>
              <dd className="font-bold">
                {bytes(d.memory.heapUsedBytes)} /{" "}
                {bytes(d.memory.heapTotalBytes)}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Active requests</dt>
              <dd className="font-bold">{d.activeRequests}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
