import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Card } from "../components/ui";
import { api } from "../lib/api";
import type { Policy } from "../lib/types";
import { ErrorBox, Loading, PageTitle } from "./DashboardPage";

const schema = z.object({
  enabled: z.boolean(),
  keywords: z.string().max(10_000),
  policy: z.string().min(1).max(10_000),
});
type Values = z.infer<typeof schema>;
export function PoliciesPage() {
  const client = useQueryClient();
  const policies = useQuery({
    queryKey: ["policies"],
    queryFn: () => api<{ data: Policy[] }>("/moderation/policies"),
  });
  const {
    register,
    reset,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { enabled: false, keywords: "", policy: "" },
  });
  useEffect(() => {
    if (!policies.data) return;
    const map = new Map(
      policies.data.data.map((item) => [item.key, item.value]),
    );
    reset({
      enabled: Boolean(map.get("moderation.enabled")),
      keywords: Array.isArray(map.get("moderation.bannedKeywords"))
        ? (map.get("moderation.bannedKeywords") as string[]).join(", ")
        : "",
      policy: String(map.get("moderation.policy") ?? ""),
    });
  }, [policies.data, reset]);
  const save = useMutation({
    mutationFn: async (values: Values) =>
      Promise.all([
        api("/moderation/policies/moderation.enabled", {
          method: "PUT",
          body: JSON.stringify({ value: values.enabled }),
        }),
        api("/moderation/policies/moderation.bannedKeywords", {
          method: "PUT",
          body: JSON.stringify({
            value: values.keywords
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          }),
        }),
        api("/moderation/policies/moderation.policy", {
          method: "PUT",
          body: JSON.stringify({ value: values.policy.trim() }),
        }),
      ]),
    onSuccess: () => client.invalidateQueries({ queryKey: ["policies"] }),
  });
  if (policies.isLoading) return <Loading />;
  if (policies.error) return <ErrorBox message={policies.error.message} />;
  return (
    <>
      <PageTitle
        title="Policy & moderation"
        description="Control local keyword rules and the policy used by AI moderation."
      />
      <form
        onSubmit={handleSubmit((v) => save.mutateAsync(v))}
        className="grid gap-5"
      >
        <Card className="flex items-center justify-between p-6">
          <div>
            <h3 className="font-bold">AI moderation</h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Queue new posts and comments for automatic review.
            </p>
          </div>
          <input
            type="checkbox"
            className="size-5 accent-emerald-700"
            {...register("enabled")}
          />
        </Card>
        <Card className="p-6">
          <label className="font-bold">Banned keywords</label>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Comma-separated words trigger an immediate content flag.
          </p>
          <textarea className="field mt-4 min-h-28" {...register("keywords")} />
        </Card>
        <Card className="p-6">
          <label className="font-bold">Community policy</label>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Human-readable rules sent to the moderation provider.
          </p>
          <textarea className="field mt-4 min-h-44" {...register("policy")} />
          {errors.policy && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.policy.message}</p>
          )}
        </Card>
        {save.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{save.error.message}</p>
        )}
        <Button
          className="justify-self-end"
          disabled={isSubmitting || save.isPending}
        >
          Save moderation settings
        </Button>
      </form>
    </>
  );
}
