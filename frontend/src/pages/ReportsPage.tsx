import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, Dialog, DialogContent } from "../components/ui";
import { api } from "../lib/api";
import type { Page, Report } from "../lib/types";
import { formatDate, titleCase } from "../lib/utils";
import { ErrorBox, Loading, PageTitle } from "./DashboardPage";

type Action = "BAN_CONTENT" | "DISMISS";
export function ReportsPage() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Report | null>(null);
  const [action, setAction] = useState<Action>("BAN_CONTENT");
  const [reason, setReason] = useState("");
  const reports = useQuery({
    queryKey: ["reports"],
    queryFn: () => api<Page<Report>>("/moderation/reports?page=1&limit=100"),
  });
  const resolve = useMutation({
    mutationFn: () =>
      api(`/moderation/reports/${target!.id}/action`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      }),
    onSuccess: async () => {
      setTarget(null);
      setReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
  if (reports.isLoading) return <Loading />;
  if (!reports.data || reports.error)
    return <ErrorBox message={reports.error?.message} />;
  return (
    <>
      <PageTitle
        title="Reported content"
        description="Ban the reported post or remove the reported comment without banning its author."
      />
      <Card className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reason</th>
              <th>Target</th>
              <th>Status</th>
              <th>Reported</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {reports.data.data.map((report) => (
              <tr key={report.id}>
                <td className="max-w-md">{report.reason}</td>
                <td>
                  <Badge>{report.postId ? "Post" : "Comment"}</Badge>
                  <small>
                    {(report.postId ?? report.commentId)?.slice(0, 8)}…
                  </small>
                </td>
                <td>
                  <Badge
                    tone={
                      report.status === "ACTIONED"
                        ? "danger"
                        : report.status === "DISMISSED"
                          ? "success"
                          : "warning"
                    }
                  >
                    {titleCase(report.status)}
                  </Badge>
                </td>
                <td>{formatDate(report.createdAt)}</td>
                <td>
                  {["PENDING", "REVIEWED"].includes(report.status) && (
                    <Button
                      variant="danger"
                      onClick={() => {
                        setTarget(report);
                        setAction("BAN_CONTENT");
                      }}
                    >
                      Take action
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => !open && setTarget(null)}
      >
        <DialogContent title="Resolve report">
          <label className="grid gap-2 text-sm font-semibold">
            Action
            <select
              className="field"
              value={action}
              onChange={(e) => setAction(e.target.value as Action)}
            >
              <option value="BAN_CONTENT">
                {target?.postId
                  ? "Ban reported post"
                  : "Remove reported comment"}
              </option>
              <option value="DISMISS">Dismiss report</option>
            </select>
          </label>
          <label className="mt-4 grid gap-2 text-sm font-semibold">
            Reason
            <textarea
              className="field min-h-28"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p className="mt-3 text-xs text-stone-500">
            Content action does not ban the author account.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <Button variant="outline">Cancel</Button>
            </DialogPrimitive.Close>
            <Button
              variant={action === "BAN_CONTENT" ? "danger" : "primary"}
              disabled={reason.trim().length < 5 || resolve.isPending}
              onClick={() => resolve.mutate()}
            >
              Confirm action
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
