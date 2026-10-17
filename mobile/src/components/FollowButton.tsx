import { t } from "../store/language";
import { Alert, Pressable, Text } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { communityApi, recipesApi } from "../api/recipes";
import { useSession } from "../store/session";
import { Button, ErrorNotice, useUI } from "./ui";
export function FollowButton({
  userId,
  initialFollowing,
  compact = false,
  followLabel = "Follow",
  inline = false,
}: {
  userId: string;
  initialFollowing?: boolean;
  compact?: boolean;
  followLabel?: string;
  inline?: boolean;
}) {
  const { colors } = useUI();
  const me = useSession((s) => s.user!.id);
  const client = useQueryClient();
  const key = ["relationship", me, userId];
  const state = useQuery({
    queryKey: key,
    initialData: initialFollowing,
    enabled: me !== userId,
    queryFn: async ({ signal }) =>
      (await communityApi.profile(userId, signal)).user.isFollowing,
  });
  const mutation = useMutation({
    mutationKey: ["follow", userId],
    scope: { id: `follow-${userId}` },
    mutationFn: () => recipesApi.follow(userId, !state.data),
    onMutate: () => client.cancelQueries({ queryKey: key }),
    onError: (error) => {
      if (inline)
        Alert.alert(
          t("Could not follow"),
          error instanceof Error ? error.message : t("Please try again."),
        );
    },
    onSuccess: async (result) => {
      client.setQueryData(key, result.following);
      await Promise.all(
        [
          "social",
          "people",
          "searchUsers",
          "searchPosts",
          "feed",
          "savedPosts",
          "post",
          "profilePosts",
          "profile",
        ].map((name) => client.invalidateQueries({ queryKey: [name] })),
      );
    },
  });
  if (me === userId) return null;
  if (inline) {
    // Keep post headers quiet; relationship controls remain available on profiles.
    if (state.isPending || (state.data && !mutation.isPending)) return null;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          state.isError ? t("Retry follow status") : t("Follow user")
        }
        accessibilityState={{
          disabled: mutation.isPending,
          busy: mutation.isPending,
        }}
        disabled={mutation.isPending}
        hitSlop={6}
        onPress={() => {
          if (state.isError) void state.refetch();
          else mutation.mutate();
        }}
        style={({ pressed }) => ({
          minHeight: 32,
          justifyContent: "center",
          paddingHorizontal: 3,
          opacity: pressed || mutation.isPending ? 0.6 : 1,
        })}
      >
        <Text
          style={{
            color: colors.brand,
            fontSize: 13,
            lineHeight: 18,
            fontWeight: "600",
          }}
        >
          ·{" "}
          {state.isError
            ? t("Retry")
            : mutation.isPending
              ? t("Following…")
              : t(followLabel)}
        </Text>
      </Pressable>
    );
  }
  if (state.isError)
    return (
      <ErrorNotice
        error={state.error}
        retry={() => {
          void state.refetch();
        }}
      />
    );
  return (
    <>
      <Button
        title={state.data ? t("Following") : t(followLabel)}
        secondary={state.data}
        style={
          compact
            ? { minHeight: 34, paddingVertical: 7, paddingHorizontal: 12 }
            : undefined
        }
        disabled={state.isPending}
        loading={mutation.isPending}
        onPress={() => mutation.mutate()}
      />
      {mutation.isError && <ErrorNotice error={mutation.error} />}
    </>
  );
}
