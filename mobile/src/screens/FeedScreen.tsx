import { t } from "../store/language";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Post } from "../api/types";
import { refreshFeed } from "../lib/feed";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParams, TabParams } from "../navigation/types";
import { recipesApi } from "../api/recipes";
import { usePeople } from "../hooks/useCommunity";
import { useSession } from "../store/session";
import { PostCard } from "../components/PostCard";
import { Avatar, Button, Empty, ErrorNotice, useUI } from "../components/ui";
import { FollowButton } from "../components/FollowButton";
export function FeedScreen() {
  const { styles, colors } = useUI();
  const client = useQueryClient();
  const list = useRef<FlatList<Post>>(null);
  const refreshLock = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const user = useSession((s) => s.user!);
  const nav = useNavigation<
    BottomTabNavigationProp<TabParams> &
      NativeStackNavigationProp<RootStackParams>
  >();
  const feed = useInfiniteQuery({
    queryKey: ["feed"],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => recipesApi.feed(pageParam, signal),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
  });
  const people = usePeople("", true);
  const refetchPeople = people.refetch;
  const reload = useCallback(async () => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    try {
      await Promise.allSettled([refreshFeed(client), refetchPeople()]);
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  }, [client, refetchPeople]);
  useEffect(
    () =>
      nav.addListener("tabPress", () => {
        list.current?.scrollToOffset({ offset: 0, animated: true });
        void reload();
      }),
    [nav, reload],
  );
  const loadMore = () => {
    if (
      !refreshLock.current &&
      feed.hasNextPage &&
      !feed.isFetching &&
      !client.isFetching({ queryKey: ["feed"], exact: true })
    ) {
      void feed.fetchNextPage({ cancelRefetch: false });
    }
  };
  const suggestions = people.data?.pages[0].data.slice(0, 6) ?? [];
  const posts = [
    ...new Map(
      (feed.data?.pages.flatMap((p) => p.data) ?? []).map((p) => [p.id, p]),
    ).values(),
  ];
  return (
    <FlatList
      ref={list}
      style={styles.screen}
      contentContainerStyle={{
        flexGrow: 1,
        gap: 8,
        paddingVertical: 8,
        paddingBottom: 30,
      }}
      data={posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PostCard post={item} />}
      ListHeaderComponent={
        <View style={{ gap: 8 }}>
          <View style={[styles.card, { borderRadius: 10 }]}>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Your profile")}
                onPress={() => nav.navigate("Profile")}
              >
                <Avatar user={user} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.navigate("Create")}
                style={{
                  flex: 1,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 13,
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 15 }}>
                  {t("What's cooking,")} {user.name.split(" ")[0]}?
                </Text>
              </Pressable>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.navigate("Create")}
                style={[
                  styles.row,
                  { flex: 1, justifyContent: "center", padding: 5 },
                ]}
              >
                <Ionicons name="images" color="#31A863" size={21} />
                <Text style={[styles.muted, { fontWeight: "700" }]}>
                  {t("Photo / recipe")}
                </Text>
              </Pressable>
              <View
                style={{ width: 1, height: 24, backgroundColor: colors.border }}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.navigate("Assistant")}
                style={[
                  styles.row,
                  { flex: 1, justifyContent: "center", padding: 5 },
                ]}
              >
                <Ionicons name="sparkles" color="#9766E7" size={21} />
                <Text style={[styles.muted, { fontWeight: "700" }]}>
                  {t("AI kitchen")}
                </Text>
              </Pressable>
            </View>
          </View>
          {!!suggestions.length && (
            <View style={[styles.card, { paddingHorizontal: 0 }]}>
              <View
                style={[
                  styles.row,
                  { justifyContent: "space-between", paddingHorizontal: 14 },
                ]}
              >
                <Text style={styles.heading}>{t("People you may know")}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => nav.navigate("People")}
                >
                  <Text style={{ color: colors.brand, fontWeight: "600" }}>
                    {t("See all")}
                  </Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}
              >
                {suggestions.map((person) => (
                  <View
                    key={person.id}
                    style={{
                      width: 148,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 12,
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        nav.navigate("UserProfile", { user: person })
                      }
                      style={{ alignItems: "center", gap: 8 }}
                    >
                      <Avatar user={person} size={64} />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.body,
                          { fontWeight: "700", fontSize: 14 },
                        ]}
                      >
                        {person.name}
                      </Text>
                    </Pressable>
                    <Text style={styles.muted}>
                      {person.followersCount} {t("followers")}
                    </Text>
                    <FollowButton
                      userId={person.id}
                      initialFollowing={person.isFollowing}
                      compact
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
          {feed.isError && !feed.isFetchNextPageError && (
            <ErrorNotice
              error={feed.error}
              retry={() => {
                void reload();
              }}
            />
          )}
        </View>
      }
      ListEmptyComponent={
        feed.isPending ? (
          <ActivityIndicator style={{ padding: 30 }} color={colors.brand} />
        ) : !feed.isError ? (
          <Empty title={t("Your feed is ready")}>
            <Text style={styles.muted}>
              {t("Share your first recipe or follow people to get inspired.")}
            </Text>
            <Button
              title={t("Create a post")}
              onPress={() => nav.navigate("Create")}
            />
          </Empty>
        ) : undefined
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void reload();
          }}
          colors={[colors.brand]}
          tintColor={colors.brand}
        />
      }
      alwaysBounceVertical
      onEndReached={() => {
        if (!feed.isFetchNextPageError) loadMore();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        <View style={{ padding: 16, gap: 8 }}>
          {feed.isFetchingNextPage ? (
            <ActivityIndicator color={colors.brand} />
          ) : feed.isFetchNextPageError ? (
            <ErrorNotice error={feed.error} retry={loadMore} />
          ) : posts.length > 0 && !feed.hasNextPage ? (
            <Text style={[styles.muted, { textAlign: "center" }]}>
              {t("You're all caught up. Pull down for new posts.")}
            </Text>
          ) : null}
        </View>
      }
    />
  );
}
