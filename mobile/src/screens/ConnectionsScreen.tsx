import { t } from "../store/language";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParams } from "../navigation/types";
import { useUsers } from "../hooks/useUsers";
import { Avatar, Button, Empty, ErrorNotice, useUI } from "../components/ui";
import { FollowButton } from "../components/FollowButton";

export function ConnectionsScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParams, "Connections">) {
  const { styles } = useUI();

  const { user, kind } = route.params;
  const query = useUsers(user.id, kind);
  const users = query.data?.pages.flatMap((page) => page.data) ?? [];
  const unique = [...new Map(users.map((item) => [item.id, item])).values()];
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={unique}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>
            {kind === "followers" ? t("Followers") : t("Following")}
          </Text>
          <Text style={styles.muted}>
            {user.name}
            {t("'s community")}
          </Text>
          {query.isError && (
            <ErrorNotice
              error={query.error}
              retry={() => {
                void query.refetch();
              }}
            />
          )}
        </>
      }
      renderItem={({ item }) => (
        <View style={[styles.card, styles.row]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(`View ${item.name}'s profile`)}
            style={[styles.row, { flex: 1 }]}
            onPress={() => navigation.push("UserProfile", { user: item })}
          >
            <Avatar user={item} />
            <Text style={[styles.body, { flex: 1 }]}>{item.name}</Text>
          </Pressable>
          <FollowButton userId={item.id} />
        </View>
      )}
      ListEmptyComponent={
        query.isPending ? (
          <ActivityIndicator />
        ) : !query.isError ? (
          <Empty title={t("No connections yet")}>
            <Text style={styles.muted}>
              {t("Community connections will appear here.")}
            </Text>
          </Empty>
        ) : undefined
      }
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => {
        void query.refetch();
      }}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetching) void query.fetchNextPage();
      }}
      onEndReachedThreshold={0.4}
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
