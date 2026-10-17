import { t } from "../store/language";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParams } from "../navigation/types";
import type { Post, PublicProfile } from "../api/types";
import { communityApi } from "../api/recipes";
import {
  Avatar,
  Empty,
  ErrorNotice,
  IconButton,
  useUI,
} from "../components/ui";
import { Segments } from "../components/Segments";
import { PostCard } from "../components/PostCard";
import { FollowButton } from "../components/FollowButton";

export function SearchScreen() {
  const { styles, colors } = useUI();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [input, setInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<"posts" | "users">("posts");
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(input.trim()), 350);
    return () => clearTimeout(timer);
  }, [input]);
  const ready = keyword.length > 0 && keyword === input.trim();
  const posts = useInfiniteQuery({
    queryKey: ["searchPosts", keyword],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      communityApi.searchPosts(keyword, pageParam, signal),
    enabled: ready && category === "posts",
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
  });
  const users = useInfiniteQuery({
    queryKey: ["searchUsers", keyword],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      communityApi.people(pageParam, keyword, false, signal),
    enabled: ready && category === "users",
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
  });
  const query = category === "posts" ? posts : users;
  const data: (Post | PublicProfile)[] = !ready
    ? []
    : category === "posts"
      ? (posts.data?.pages.flatMap((p) => p.data) ?? [])
      : (users.data?.pages.flatMap((p) => p.data) ?? []);
  const unique = [...new Map(data.map((item) => [item.id, item])).values()];
  const next = () => {
    if (ready && query.hasNextPage && !query.isFetching)
      void query.fetchNextPage({ cancelRefetch: false });
  };
  return (
    <View style={[styles.screen, { flex: 1 }]}>
      <View style={{ padding: 14, gap: 12, backgroundColor: colors.surface }}>
        <View style={[styles.row, styles.input]}>
          <Ionicons name="search" size={21} color={colors.muted} />
          <TextInput
            autoFocus
            accessibilityLabel={t("Search posts and users")}
            placeholder={t("Search posts and people")}
            placeholderTextColor={colors.muted}
            value={input}
            maxLength={100}
            onChangeText={setInput}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => setKeyword(input.trim())}
            style={{ flex: 1, color: colors.ink, fontSize: 16, minWidth: 0 }}
          />
          {!!input && (
            <IconButton
              name="close-circle"
              label={t("Clear search")}
              onPress={() => {
                setInput("");
                setKeyword("");
              }}
            />
          )}
        </View>
        <Segments
          value={category}
          onChange={setCategory}
          items={[
            { value: "posts", label: t("Posts") },
            { value: "users", label: t("Users") },
          ]}
        />
      </View>
      <FlatList<Post | PublicProfile>
        key={`${category}:${keyword}`}
        data={unique}
        contentContainerStyle={{
          flexGrow: 1,
          gap: 8,
          paddingVertical: 8,
          paddingBottom: 30,
        }}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) =>
          "content" in item ? (
            <PostCard post={item} />
          ) : (
            <View style={[styles.card, styles.row]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.push("UserProfile", { user: item })}
                style={[styles.row, { flex: 1 }]}
              >
                <Avatar user={item} size={54} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.body, { fontWeight: "700" }]}>
                    {item.name}
                  </Text>
                  <Text style={styles.muted}>
                    {item.followersCount} {t("followers")}
                  </Text>
                </View>
              </Pressable>
              <FollowButton
                userId={item.id}
                initialFollowing={item.isFollowing}
                compact
              />
            </View>
          )
        }
        ListHeaderComponent={
          ready ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
              <Text style={styles.muted}>
                {query.data?.pages[0]?.pagination.total ?? 0}{" "}
                {t(category === "posts" ? "Posts" : "Users")} {t("for “")}
                {keyword}”
              </Text>
              {query.isError && !query.isFetchNextPageError && (
                <ErrorNotice
                  error={query.error}
                  retry={() => {
                    void query.refetch();
                  }}
                />
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !input.trim() ? (
            <Empty title={t("Search the community")}>
              <Text style={styles.muted}>
                {t("Find recipes by keyword or people by name.")}
              </Text>
            </Empty>
          ) : !ready || query.isPending ? (
            <ActivityIndicator style={{ padding: 30 }} color={colors.brand} />
          ) : !query.isError ? (
            <Empty title={t(`No ${category} found`)}>
              <Text style={styles.muted}>
                {t("Try another keyword or switch categories.")}
              </Text>
            </Empty>
          ) : null
        }
        onEndReached={() => {
          if (!query.isFetchNextPageError) next();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          ready && query.isFetchingNextPage ? (
            <ActivityIndicator style={{ padding: 20 }} color={colors.brand} />
          ) : ready && query.isFetchNextPageError ? (
            <ErrorNotice error={query.error} retry={next} />
          ) : null
        }
      />
    </View>
  );
}
