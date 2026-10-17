import { t } from "../store/language";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { libraryApi, type FilterKind } from "../api/library";
import type { SocialUser } from "../api/types";
import { useSafety } from "../hooks/useSafety";
import { Avatar, Button, Empty, ErrorNotice, useUI } from "../components/ui";
import { Segments } from "../components/Segments";
function FilterRow({ user, kind }: { user: SocialUser; kind: FilterKind }) {
  const { styles } = useUI();
  const safety = useSafety(user.id);
  return (
    <View style={[styles.card, styles.row]}>
      <Avatar user={user} />
      <Text style={[styles.body, { flex: 1 }]}>{user.name}</Text>
      <Button
        title={kind === "BLOCK" ? t("Unblock") : t("Unmute")}
        secondary
        loading={safety.pending}
        onPress={() => safety.confirm(kind, user.name, false)}
      />
    </View>
  );
}
export function FiltersScreen() {
  const { styles, colors } = useUI();
  const [kind, setKind] = useState<FilterKind>("BLOCK");
  const query = useInfiniteQuery({
    queryKey: ["filters", kind],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      libraryApi.filters(kind, pageParam, signal),
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
      keyExtractor={(u) => u.id}
      renderItem={({ item }) => <FilterRow user={item} kind={kind} />}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <Segments
            value={kind}
            onChange={setKind}
            items={[
              { value: "BLOCK", label: t("Blocked") },
              { value: "MUTE", label: t("Muted") },
            ]}
          />
          <Text style={styles.muted}>
            {kind === "BLOCK"
              ? t(
                  "Blocked users cannot view your profile or posts. Blocking removes both follow connections.",
                )
              : t("Muted users are hidden from your feed and notifications.")}
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
      ListEmptyComponent={
        query.isPending ? (
          <ActivityIndicator color={colors.brand} />
        ) : !query.isError ? (
          <Empty
            title={
              kind === "BLOCK" ? t("No blocked users") : t("No muted users")
            }
          />
        ) : null
      }
      onEndReached={() => {
        if (
          query.hasNextPage &&
          !query.isFetching &&
          !query.isFetchNextPageError
        )
          void query.fetchNextPage();
      }}
    />
  );
}
