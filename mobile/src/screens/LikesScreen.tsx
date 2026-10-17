import { t } from "../store/language";
import { RelativeTime } from "../components/RelativeTime";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParams } from "../navigation/types";
import { recipesApi } from "../api/recipes";
import { Avatar, Button, Empty, ErrorNotice, useUI } from "../components/ui";
import { FollowButton } from "../components/FollowButton";
export function LikesScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParams, "Likes">) {
  const { styles, colors } = useUI();
  const query = useInfiniteQuery({
    queryKey: ["postLikes", route.params.postId],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      recipesApi.likes(route.params.postId, pageParam, signal),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
  });
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={query.data?.pages.flatMap((p) => p.data) ?? []}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          <Text style={[styles.heading, { color: colors.brand }]}>
            {t("♥ All ·")}
            {query.data?.pages[0]?.pagination.total ?? 0}
          </Text>
          {query.isError && (
            <ErrorNotice
              error={query.error}
              retry={() => {
                void query.refetch();
              }}
            />
          )}
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.row, { paddingVertical: 10 }]}>
          <Pressable
            onPress={() => navigation.push("UserProfile", { user: item })}
            style={[styles.row, { flex: 1 }]}
          >
            <Avatar user={item} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.body, { fontWeight: "700" }]}>
                {item.name}
              </Text>
              {item.likedAt && (
                <RelativeTime value={item.likedAt} style={styles.muted} />
              )}
            </View>
          </Pressable>
          <FollowButton userId={item.id} initialFollowing={item.isFollowing} />
        </View>
      )}
      ListEmptyComponent={
        query.isPending ? (
          <ActivityIndicator />
        ) : !query.isError ? (
          <Empty title={t("No likes yet")} />
        ) : undefined
      }
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => {
        void query.refetch();
      }}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetching) void query.fetchNextPage();
      }}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator />
        ) : query.hasNextPage ? (
          <Button
            title={t("Load more")}
            secondary
            onPress={() => {
              void query.fetchNextPage();
            }}
          />
        ) : undefined
      }
    />
  );
}
