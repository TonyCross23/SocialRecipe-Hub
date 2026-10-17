import { notificationMessage } from "../i18n/translate";
import { t, useLanguage } from "../store/language";
import { useLayoutEffect } from "react";
import { FollowButton } from "../components/FollowButton";
import { RelativeTime } from "../components/RelativeTime";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { z } from "zod";
import type { RootStackParams } from "../navigation/types";
import type { AppNotification } from "../api/types";
import { communityApi } from "../api/recipes";
import { useNotificationSummary } from "../hooks/useCommunity";
import {
  Avatar,
  Empty,
  ErrorNotice,
  IconButton,
  useUI,
} from "../components/ui";
const actionSchema = z.object({
  actor: z
    .object({ id: z.uuid(), name: z.string(), image: z.string().nullable() })
    .optional(),
  postId: z.uuid().optional(),
});
export function NotificationsScreen() {
  const { styles, colors } = useUI();
  const language = useLanguage((s) => s.language);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const client = useQueryClient();
  const summary = useNotificationSummary();
  const query = useInfiniteQuery({
    queryKey: ["notifications"],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      communityApi.notifications(pageParam, signal),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
    refetchInterval: 15000,
  });
  const read = useMutation({
    mutationFn: (id: string | undefined) => communityApi.readNotification(id),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["notifications"] }),
        client.invalidateQueries({ queryKey: ["notificationSummary"] }),
      ]);
    },
  });
  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", gap: 6, marginRight: 12 }}>
          <IconButton
            name="checkmark-done-outline"
            label={t("Mark all notifications read")}
            disabled={read.isPending || !summary.data?.unreadCount}
            onPress={() => read.mutate(undefined)}
          />
          <IconButton
            name="settings-outline"
            label={t("Settings")}
            onPress={() => nav.push("Settings")}
          />
        </View>
      ),
    });
  }, [nav, read.mutate, read.isPending, summary.data?.unreadCount]);
  function open(item: AppNotification) {
    if (!item.readAt) read.mutate(item.id);
    const data = actionSchema.safeParse(item.data);
    if (data.success) {
      if (data.data.postId) nav.push("Post", { postId: data.data.postId });
      else if (data.data.actor)
        nav.push("UserProfile", { user: data.data.actor });
    }
  }
  const data = query.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 28 }}
      data={data}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        (query.isError && !query.isFetchNextPageError) || read.isError ? (
          <View style={{ padding: 12, gap: 8 }}>
            {query.isError && !query.isFetchNextPageError && (
              <ErrorNotice
                error={query.error}
                retry={() => {
                  void query.refetch();
                }}
              />
            )}
            {read.isError && <ErrorNotice error={read.error} />}
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const parsed = actionSchema.safeParse(item.data);
        const actor = parsed.success ? parsed.data.actor : undefined;
        return (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 12,
              backgroundColor: item.readAt ? colors.surface : colors.pale,
              borderBottomWidth: 0.5,
              borderColor: colors.border,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(
                `${item.readAt ? "" : "Unread: "}${notificationMessage(item, language)}`,
              )}
              onPress={() => open(item)}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: 0,
                flexDirection: "row",
                gap: 10,
                alignItems: "center",
                paddingVertical: 12,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <View>
                <Avatar
                  user={
                    actor ?? {
                      name: item.type === "FOLLOW" ? "FR" : "SR",
                      image: null,
                    }
                  }
                  size={40}
                />
                <View
                  style={{
                    position: "absolute",
                    right: -2,
                    bottom: -2,
                    backgroundColor: colors.brand,
                    borderRadius: 10,
                    padding: 3,
                    borderWidth: 1.5,
                    borderColor: item.readAt ? colors.surface : colors.pale,
                  }}
                >
                  <Ionicons
                    name={
                      item.type === "FOLLOW"
                        ? "person-add"
                        : item.type === "LIKE"
                          ? "heart"
                          : item.type === "SHARE"
                            ? "arrow-redo"
                            : "chatbubble"
                    }
                    size={10}
                    color="#fff"
                  />
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text
                  numberOfLines={2}
                  style={{
                    color: colors.ink,
                    fontSize: 13,
                    lineHeight: 18,
                    fontWeight: item.readAt ? "400" : "600",
                  }}
                >
                  {notificationMessage(item, language)}
                </Text>
                <View
                  style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
                >
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 11,
                      lineHeight: 15,
                    }}
                  >
                    <RelativeTime value={item.createdAt} />
                  </Text>
                  {!item.readAt && (
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: colors.brand,
                      }}
                    />
                  )}
                </View>
              </View>
            </Pressable>
            {item.type === "FOLLOW" && actor && (
              <View style={{ maxWidth: "36%", paddingVertical: 8 }}>
                <FollowButton
                  userId={actor.id}
                  followLabel="Follow back"
                  compact
                />
              </View>
            )}
          </View>
        );
      }}
      ListEmptyComponent={
        query.isPending ? (
          <ActivityIndicator color={colors.brand} />
        ) : !query.isError ? (
          <Empty title={t("You're all caught up")}>
            <Text style={styles.muted}>
              {t("New followers, likes and comments will appear here.")}
            </Text>
          </Empty>
        ) : undefined
      }
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => {
        void query.refetch();
        void summary.refetch();
      }}
      onEndReached={() => {
        if (
          query.hasNextPage &&
          !query.isFetching &&
          !query.isFetchNextPageError
        )
          void query.fetchNextPage({ cancelRefetch: false });
      }}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator style={{ padding: 16 }} color={colors.brand} />
        ) : query.isFetchNextPageError ? (
          <ErrorNotice
            error={query.error}
            retry={() => {
              void query.fetchNextPage();
            }}
          />
        ) : null
      }
    />
  );
}
