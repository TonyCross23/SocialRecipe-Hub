import { t } from "../store/language";
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
import { libraryApi } from "../api/library";
import { Button, Empty, ErrorNotice, useUI } from "../components/ui";
export function ShoppingListsScreen({
  navigation,
}: NativeStackScreenProps<RootStackParams, "ShoppingLists">) {
  const { styles, colors } = useUI();
  const query = useInfiniteQuery({
    queryKey: ["shoppingLists"],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => libraryApi.lists(pageParam, signal),
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
      keyExtractor={(l) => l.id}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <Button
            title={t("+ New shopping list")}
            onPress={() => navigation.push("ShoppingList", {})}
          />
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
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.push("ShoppingList", { id: item.id })}
          style={styles.card}
        >
          <Text style={styles.heading}>{item.title}</Text>
          <Text style={styles.muted}>
            {item._count.items} {t("items")}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={
        query.isPending ? (
          <ActivityIndicator color={colors.brand} />
        ) : !query.isError ? (
          <Empty title={t("Your next grocery run")}>
            <Text style={styles.muted}>
              {t("Create a list, or add ingredients from a recipe or AI Cook.")}
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
          void query.fetchNextPage();
      }}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator color={colors.brand} />
        ) : null
      }
    />
  );
}
