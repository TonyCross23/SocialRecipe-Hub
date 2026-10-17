import { t } from "../store/language";
import { ActivityIndicator, FlatList, Text } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { libraryApi } from "../api/library";
import { PostCard } from "../components/PostCard";
import { Empty, ErrorNotice, useUI } from "../components/ui";
export function SavedScreen() {
  const { styles, colors } = useUI();
  const query = useInfiniteQuery({
    queryKey: ["savedPosts"],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => libraryApi.saved(pageParam, signal),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
  });
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ flexGrow: 1, gap: 8, paddingVertical: 8 }}
      data={query.data?.pages.flatMap((p) => p.data) ?? []}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PostCard post={item} />}
      ListHeaderComponent={
        query.isError ? (
          <ErrorNotice
            error={query.error}
            retry={() => {
              void query.refetch();
            }}
          />
        ) : null
      }
      ListEmptyComponent={
        query.isPending ? (
          <ActivityIndicator color={colors.brand} />
        ) : !query.isError ? (
          <Empty title={t("No saved recipes yet")}>
            <Text style={styles.muted}>
              {t(
                "Open a post's ⋯ menu and choose Save post. Only posts you can still access appear here.",
              )}
            </Text>
          </Empty>
        ) : null
      }
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => {
        void query.refetch();
      }}
      onEndReached={() => {
        if (
          query.hasNextPage &&
          !query.isFetching &&
          !query.isFetchNextPageError
        )
          void query.fetchNextPage({ cancelRefetch: false });
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator style={{ padding: 16 }} color={colors.brand} />
        ) : null
      }
    />
  );
}
