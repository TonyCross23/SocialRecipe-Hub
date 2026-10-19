import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Badge, Button, Card, Dialog, DialogContent } from "../components/ui";
import { api } from "../lib/api";
import type { Page } from "../lib/types";
import { ErrorBox, Loading, PageTitle } from "./DashboardPage";
import { formatDate } from "../lib/utils";
interface Appeal {
  id: string;
  message: string;
  status: string;
  response: string | null;
  createdAt: string;
  bannedAt: string;
  reviewer: { name: string } | null;
  user: {
    id: string;
    name: string;
    email: string;
    status: string;
    bannedReason: string | null;
  };
}
export function AppealsPage() {
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<Appeal | null>(null);
  const [response, setResponse] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["appeals", status, page],
    queryFn: () =>
      api<Page<Appeal>>(
        `/admin/appeals?status=${status}&page=${page}&limit=20`,
      ),
    refetchInterval: 20000,
  });
  const review = useMutation({
    mutationFn: (decision: "APPROVED" | "REJECTED") => {
      if (!response.trim()) throw new Error("Write a response for the member.");
      return api<{ appeal: Appeal }>(`/admin/appeals/${target!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision, response: response.trim() }),
      });
    },
    onSuccess: async () => {
      setTarget(null);
      setResponse("");
      await Promise.all(
        ["appeals", "users", "notifications"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
  return (
    <>
      <PageTitle
        title="Account appeals"
        description="Review requests from banned members. Approval restores access and requires a fresh sign-in."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {["PENDING", "APPROVED", "REJECTED", "STALE", "ALL"].map((value) => (
          <Button
            key={value}
            variant={status === value ? "primary" : "outline"}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {value}
          </Button>
        ))}
      </div>
      {query.isError && <ErrorBox message={query.error.message} />}
      {query.isPending && <Loading />}
      {query.data && (
        <Card className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Appeal</th>
                <th>Status</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {query.data.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.user.name}</strong>
                    <small>{item.user.email}</small>
                  </td>
                  <td className="max-w-sm">
                    <p className="line-clamp-2 whitespace-pre-wrap">
                      {item.message}
                    </p>
                  </td>
                  <td>
                    <Badge
                      tone={
                        item.status === "APPROVED"
                          ? "success"
                          : item.status === "REJECTED"
                            ? "danger"
                            : undefined
                      }
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <Button
                      variant="outline"
                      onClick={() => {
                        review.reset();
                        setTarget(item);
                        setResponse(item.response ?? "");
                      }}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
              {!query.data.data.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center">
                    No appeals in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
      <div className="mt-4 flex items-center justify-end gap-3">
        <Button
          variant="outline"
          disabled={page <= 1 || query.isFetching}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span className="text-sm">
          Page {page} / {Math.max(1, query.data?.pagination.totalPages ?? 1)}
        </span>
        <Button
          variant="outline"
          disabled={
            query.isFetching || page >= (query.data?.pagination.totalPages ?? 0)
          }
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
      <Dialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open && !review.isPending) setTarget(null);
        }}
      >
        <DialogContent title="Review account appeal">
          <DialogPrimitive.Description className="text-sm text-stone-500 dark:text-stone-400">
            {target?.user.name} · {target?.user.email}
          </DialogPrimitive.Description>
          {target && (
            <div className="grid gap-4">
              <div>
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  BAN REASON
                </p>
                <p className="whitespace-pre-wrap">
                  {target.user.bannedReason ?? "No current ban reason"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  MEMBER MESSAGE
                </p>
                <p className="whitespace-pre-wrap break-words">
                  {target.message}
                </p>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                Response to member
                <textarea
                  className="min-h-28 rounded-xl border border-stone-300 dark:border-stone-700 p-3"
                  value={response}
                  maxLength={1000}
                  disabled={review.isPending || target.status !== "PENDING"}
                  onChange={(event) => setResponse(event.target.value)}
                />
              </label>
              {review.isError && <ErrorBox message={review.error.message} />}
              {target.status === "PENDING" ? (
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={review.isPending || !response.trim()}
                    onClick={() => review.mutate("APPROVED")}
                  >
                    Approve & unban
                  </Button>
                  <Button
                    variant="danger"
                    disabled={review.isPending || !response.trim()}
                    onClick={() => review.mutate("REJECTED")}
                  >
                    Reject appeal
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {target.status}
                  {target.reviewer
                    ? ` · Reviewed by ${target.reviewer.name}`
                    : ""}
                </p>
              )}
              <p className="text-xs text-stone-500 dark:text-stone-400">
                If the ban has changed since submission, this appeal is marked
                stale instead of unbanning a newer restriction.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
