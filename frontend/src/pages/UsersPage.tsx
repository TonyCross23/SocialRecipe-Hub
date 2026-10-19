import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, Dialog, DialogContent } from "../components/ui";
import { api } from "../lib/api";
import type { AdminUser, Page } from "../lib/types";
import { formatDate } from "../lib/utils";
import { useAuthStore } from "../store/auth-store";
import { ErrorBox, Loading, PageTitle } from "./DashboardPage";

export function UsersPage() {
  const currentId = useAuthStore((s) => s.user!.id);
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState("");
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<Page<AdminUser>>("/admin/users?page=1&limit=100"),
  });
  const ban = useMutation({
    mutationFn: () =>
      api(`/admin/users/${target!.id}/ban`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: async () => {
      setTarget(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
  const unban = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/users/${id}/ban`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  if (users.isLoading) return <Loading />;
  if (!users.data || users.error)
    return <ErrorBox message={users.error?.message} />;
  return (
    <>
      <PageTitle
        title="Users"
        description="Review accounts and apply account-level bans separately from content moderation."
      />
      <Card className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Posts</th>
              <th>Followers</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.data.data.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </td>
                <td>
                  <Badge>{user.role}</Badge>
                </td>
                <td>
                  <Badge tone={user.status === "ACTIVE" ? "success" : "danger"}>
                    {user.status}
                  </Badge>
                </td>
                <td>{user.counts.posts}</td>
                <td>{user.counts.followers}</td>
                <td>{formatDate(user.createdAt)}</td>
                <td>
                  {user.id === currentId ? (
                    <span className="text-xs text-stone-400 dark:text-stone-500">
                      Current account
                    </span>
                  ) : user.status === "BANNED" ? (
                    <Button
                      variant="outline"
                      onClick={() => unban.mutate(user.id)}
                    >
                      Unban
                    </Button>
                  ) : (
                    <Button variant="danger" onClick={() => setTarget(user)}>
                      Ban user
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
        <DialogContent title={`Ban ${target?.name ?? "user"}`}>
          <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
            This revokes active sessions and blocks login. Their posts are
            managed separately.
          </p>
          <textarea
            className="field min-h-28"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for account ban"
          />
          <div className="mt-5 flex justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <Button variant="outline">Cancel</Button>
            </DialogPrimitive.Close>
            <Button
              variant="danger"
              disabled={reason.trim().length < 5 || ban.isPending}
              onClick={() => ban.mutate()}
            >
              Confirm ban
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
