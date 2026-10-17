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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParams } from "../navigation/types";
import type { SocialUser } from "../api/types";
import { usePeople } from "../hooks/useCommunity";
import { useUsers } from "../hooks/useUsers";
import { useSession } from "../store/session";
import { Avatar, Button, Empty, ErrorNotice, useUI } from "../components/ui";
import { Segments } from "../components/Segments";
import { FollowButton } from "../components/FollowButton";
export function PeopleScreen() {
  const { styles, colors } = useUI();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const me = useSession((s) => s.user!);
  const [tab, setTab] = useState<"discover" | "following" | "followers">(
    "discover",
  );
  const [search, setSearch] = useState("");
  const [queryText, setQueryText] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQueryText(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const people = usePeople(queryText);
  const following = useUsers(me.id, "following");
  const followers = useUsers(me.id, "followers");
  const query =
    tab === "discover" ? people : tab === "following" ? following : followers;
  const users: SocialUser[] =
    query.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={users}
      keyExtractor={(u) => u.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: 14, paddingBottom: 4 }}>
          <Text style={styles.title}>{t("Your people")}</Text>
          <Text style={styles.muted}>
            {t("Find cooks to follow. Build a community around what you love.")}
          </Text>
          <Segments
            value={tab}
            onChange={setTab}
            items={[
              { value: "discover", label: t("Discover") },
              { value: "following", label: t("Following") },
              { value: "followers", label: t("Followers") },
            ]}
          />
          {tab === "discover" && (
            <View
              style={[
                styles.row,
                styles.input,
                { backgroundColor: colors.surface },
              ]}
            >
              <Ionicons name="search" size={20} color={colors.muted} />
              <TextInput
                accessibilityLabel={t("Search people")}
                placeholder={t("Search by name")}
                placeholderTextColor={colors.muted}
                style={{ flex: 1, color: colors.ink, fontSize: 16 }}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
            </View>
          )}
          <Text style={styles.heading}>
            {tab === "discover"
              ? t("People in the community")
              : tab === "following"
                ? t("People you follow")
                : t("Your followers")}
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
        <View style={[styles.card, styles.row]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.push("UserProfile", { user: item })}
            style={[styles.row, { flex: 1 }]}
          >
            <Avatar user={item} size={60} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.body, { fontWeight: "700" }]}>
                {item.name}
              </Text>
              <Text style={styles.muted}>
                {"followersCount" in item
                  ? t(`${item.followersCount} followers`)
                  : t("Community cook")}
              </Text>
            </View>
          </Pressable>
          <FollowButton
            userId={item.id}
            initialFollowing={
              "isFollowing" in item
                ? Boolean(item.isFollowing)
                : tab === "following"
                  ? true
                  : undefined
            }
          />
        </View>
      )}
      ListEmptyComponent={
        query.isPending ? (
          <ActivityIndicator color={colors.brand} />
        ) : !query.isError ? (
          <Empty
            title={
              search ? t("No people found") : t("Your community starts here")
            }
          >
            <Text style={styles.muted}>
              {search
                ? t("Try another name.")
                : t(
                    "People and connections will appear here as the community grows.",
                  )}
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
