import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card } from "../components/ui";
import { api } from "../lib/api";
import type { Page } from "../lib/types";
import { formatDate, titleCase } from "../lib/utils";
import { ErrorBox, Loading, PageTitle } from "./DashboardPage";

type AuditLog = {
  id: string;
  postId: string | null;
  commentId: string | null;
  status: string;
  attempts: number;
  result: unknown;
  lastError: string | null;
  createdAt: string;
};
export function AuditLogsPage() {
  const client = useQueryClient();
  const logs = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => api<Page<AuditLog>>("/admin/audit-logs?page=1&limit=100"),
  });
  const override = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "APPROVE" | "BAN_CONTENT";
    }) =>
      api(`/admin/audit-logs/${id}/override`, {
        method: "POST",
        body: JSON.stringify({ action }),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["audit-logs"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
  if (logs.isLoading) return <Loading />;
  if (!logs.data || logs.error)
    return <ErrorBox message={logs.error?.message} />;
  return (
    <>
      <PageTitle
        title="AI auto-pilot audit"
        description="Inspect every moderation job and override the resulting content status."
      />
      <Card className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Content</th>
              <th>Decision</th>
              <th>Attempts</th>
              <th>Processed</th>
              <th>Override</th>
            </tr>
          </thead>
          <tbody>
            {logs.data.data.map((log) => (
              <tr key={log.id}>
                <td>
                  <Badge>{log.postId ? "Post" : "Comment"}</Badge>
                  <small>{(log.postId ?? log.commentId)?.slice(0, 8)}…</small>
                </td>
                <td>
                  <Badge
                    tone={
                      log.status === "APPROVED"
                        ? "success"
                        : log.status === "FLAGGED" || log.status === "FAILED"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {titleCase(log.status)}
                  </Badge>
                  {log.lastError && (
                    <small className="text-red-600 dark:text-red-400">{log.lastError}</small>
                  )}
                </td>
                <td>{log.attempts}</td>
                <td>{formatDate(log.createdAt)}</td>
                <td>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={override.isPending}
                      onClick={() =>
                        override.mutate({ id: log.id, action: "APPROVE" })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      disabled={override.isPending}
                      onClick={() =>
                        override.mutate({ id: log.id, action: "BAN_CONTENT" })
                      }
                    >
                      {log.postId ? "Ban post" : "Remove comment"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
