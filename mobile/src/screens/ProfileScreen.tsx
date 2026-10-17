import { t, dateLocale } from "../store/language";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { RootStackParams } from "../navigation/types";
import { useSession } from "../store/session";
import { communityApi } from "../api/recipes";
import { libraryApi } from "../api/library";
import { useSafety } from "../hooks/useSafety";
import { useProfilePosts } from "../hooks/useCommunity";
import { Avatar, ErrorNotice, IconButton, useUI } from "../components/ui";
import { SettingsRow } from "../components/SettingsRow";
import { FollowButton } from "../components/FollowButton";
import { PostCard } from "../components/PostCard";
import { DropdownMenu, type MenuAnchor } from "../components/DropdownMenu";
export function ProfileScreen() {
  const { styles, colors } = useUI();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const route = useRoute<RouteProp<RootStackParams, "UserProfile">>();
  const me = useSession((s) => s.user!);
  const selected = route.params?.user ?? me;
  const own = selected.id === me.id;
  const [tab, setTab] = useState<"posts" | "saved" | "about">("posts");
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const anchor = useRef<View>(null);
  const safety = useSafety(selected.id, () => {
    if (nav.canGoBack()) nav.goBack();
  });
  const filter = useQuery({
    queryKey: ["filterState", selected.id],
    queryFn: ({ signal }) => libraryApi.filterState(selected.id, signal),
    enabled: !own,
  });
  const profile = useQuery({
    queryKey: ["profile", selected.id],
    queryFn: ({ signal }) => communityApi.profile(selected.id, signal),
  });
  const user = own ? me : (profile.data?.user ?? selected);
  const details = profile.data?.user;
  const posts = useProfilePosts(user.id);
  const saved = useInfiniteQuery({
    queryKey: ["savedPosts"],
    initialPageParam: 1,
    enabled: own && tab === "saved",
    queryFn: ({ pageParam, signal }) => libraryApi.saved(pageParam, signal),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
  });
  const current = tab === "saved" ? saved : posts;
  const data =
    tab === "about" || profile.isError
      ? []
      : [
          ...new Map(
            (current.data?.pages.flatMap((p) => p.data) ?? []).map((p) => [
              p.id,
              p,
            ]),
          ).values(),
        ];
  const tabs = own
    ? ([
        { value: "posts", label: t("Posts") },
        { value: "saved", label: t("Saved") },
        { value: "about", label: t("About") },
      ] as const)
    : ([{ value: "posts", label: t("Posts") }] as const);
  if (profile.isError && !own)
    return (
      <View style={styles.screen}>
        <ErrorNotice
          error={profile.error}
          retry={() => {
            void profile.refetch();
          }}
        />
      </View>
    );
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ flexGrow: 1, gap: 8, paddingBottom: 28 }}
      data={data}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PostCard post={item} />}
      ListHeaderComponent={
        <View style={{ backgroundColor: colors.surface }}>
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 24,
              paddingBottom: 18,
              gap: 20,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 16 }}
            >
              <Pressable
                accessibilityRole={own ? "button" : "image"}
                accessibilityLabel={
                  own ? t("Edit profile photo") : t(`${user.name}'s photo`)
                }
                disabled={!own}
                onPress={() => nav.push("EditProfile")}
              >
                <Avatar user={user} size={80} />
              </Pressable>
              <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
                <Text
                  style={{
                    color: colors.ink,
                    fontSize: 23,
                    lineHeight: 30,
                    fontWeight: "700",
                  }}
                >
                  {user.name}
                </Text>
                {own ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => nav.push("EditProfile")}
                    style={{
                      alignSelf: "flex-start",
                      flexDirection: "row",
                      gap: 5,
                      alignItems: "center",
                      paddingVertical: 5,
                    }}
                  >
                    <Ionicons
                      name="create-outline"
                      size={15}
                      color={colors.brand}
                    />
                    <Text
                      style={{
                        color: colors.brand,
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      {t("Edit profile")}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={{ alignSelf: "flex-start" }}>
                    <FollowButton
                      userId={user.id}
                      initialFollowing={details?.isFollowing}
                      compact
                    />
                  </View>
                )}
              </View>
              {!own && (
                <View ref={anchor} collapsable={false}>
                  <IconButton
                    name="ellipsis-horizontal"
                    label={t("Profile options")}
                    disabled={safety.pending}
                    onPress={() =>
                      anchor.current?.measureInWindow((x, y, width, height) =>
                        setMenu({ x, y, width, height }),
                      )
                    }
                  />
                </View>
              )}
            </View>
            <View
              style={{
                flexDirection: "row",
                borderTopWidth: 0.5,
                borderBottomWidth: 0.5,
                borderColor: colors.border,
              }}
            >
              {[
                {
                  label: t("Posts"),
                  count: details?.postsCount,
                  action: () => setTab("posts"),
                },
                {
                  label: t("Followers"),
                  count: details?.followersCount,
                  action: () =>
                    nav.push("Connections", { user, kind: "followers" }),
                },
                {
                  label: t("Following"),
                  count: details?.followingCount,
                  action: () =>
                    nav.push("Connections", { user, kind: "following" }),
                },
              ].map((stat) => (
                <Pressable
                  key={stat.label}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    `${stat.count ?? "Loading"} ${stat.label}`,
                  )}
                  onPress={stat.action}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: 15,
                    gap: 4,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.ink,
                      fontWeight: "700",
                      fontSize: 20,
                    }}
                  >
                    {stat.count ?? "—"}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {t(stat.label)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {own && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Open shopping lists")}
                onPress={() => nav.push("ShoppingLists")}
                style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
              >
                <Ionicons
                  name="basket-outline"
                  size={19}
                  color={colors.muted}
                />
                <Text style={{ flex: 1, color: colors.ink, fontSize: 14 }}>
                  {t("Shopping lists")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.muted}
                />
              </Pressable>
            )}
          </View>
          <View
            style={{
              flexDirection: "row",
              borderBottomWidth: 0.5,
              borderColor: colors.border,
              paddingHorizontal: 12,
            }}
          >
            {tabs.map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === item.value }}
                onPress={() => setTab(item.value)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  minHeight: 46,
                  justifyContent: "center",
                  borderBottomWidth: 2,
                  borderColor:
                    tab === item.value ? colors.brand : "transparent",
                }}
              >
                <Text
                  style={{
                    color: tab === item.value ? colors.brand : colors.muted,
                    fontSize: 14,
                    fontWeight: "600",
                  }}
                >
                  {t(item.label)}
                </Text>
              </Pressable>
            ))}
          </View>
          {profile.isError && (
            <ErrorNotice
              error={profile.error}
              retry={() => {
                void profile.refetch();
              }}
            />
          )}
          {tab !== "about" &&
            current.isError &&
            !current.isFetchNextPageError && (
              <ErrorNotice
                error={current.error}
                retry={() => {
                  void current.refetch();
                }}
              />
            )}
          {tab === "posts" && own && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Create a post")}
              onPress={() => nav.navigate("Tabs", { screen: "Create" })}
              style={{
                padding: 14,
                flexDirection: "row",
                gap: 10,
                alignItems: "center",
              }}
            >
              <Avatar user={me} size={32} />
              <Text style={{ color: colors.muted, fontSize: 14, flex: 1 }}>
                {t("Share something from your kitchen…")}
              </Text>
              <Ionicons name="images-outline" color={colors.brand} size={21} />
            </Pressable>
          )}
          {tab === "about" && own && (
            <View style={{ paddingVertical: 6 }}>
              <SettingsRow
                icon="mail-outline"
                title={me.email}
                subtitle="Email · only you"
              />
              <SettingsRow
                icon="calendar-outline"
                title={new Date(
                  `${me.dob.slice(0, 10)}T12:00:00`,
                ).toLocaleDateString(dateLocale(), {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                subtitle="Birthday · only you"
              />
              <SettingsRow
                icon="time-outline"
                title={new Date(me.createdAt).toLocaleDateString(dateLocale(), {
                  year: "numeric",
                  month: "long",
                })}
                subtitle="Joined SocialRecipe"
                last
              />
            </View>
          )}
          {menu && (
            <DropdownMenu
              anchor={menu}
              onClose={() => setMenu(null)}
              actions={[
                {
                  text: filter.data?.muted ? "Unmute" : "Mute",
                  icon: "volume-mute-outline",
                  onPress: () =>
                    safety.confirm("MUTE", user.name, !filter.data?.muted),
                },
                {
                  text: t("Block"),
                  icon: "ban-outline",
                  destructive: true,
                  onPress: () => safety.confirm("BLOCK", user.name),
                },
              ]}
            />
          )}
        </View>
      }
      ListEmptyComponent={
        tab !== "about" ? (
          current.isPending ? (
            <ActivityIndicator style={{ padding: 30 }} color={colors.brand} />
          ) : !current.isError ? (
            <View style={{ alignItems: "center", padding: 32, gap: 9 }}>
              <Ionicons
                name={tab === "saved" ? "bookmark-outline" : "reader-outline"}
                size={28}
                color={colors.muted}
              />
              <Text
                style={{ color: colors.ink, fontSize: 15, fontWeight: "600" }}
              >
                {tab === "saved"
                  ? t("No saved recipes yet")
                  : t("No posts yet")}
              </Text>
              {tab === "saved" && (
                <Text style={[styles.muted, { textAlign: "center" }]}>
                  {t("Save a post from its ⋯ menu to find it here.")}
                </Text>
              )}
            </View>
          ) : null
        ) : null
      }
      refreshing={
        (current.isRefetching && !current.isFetchingNextPage) ||
        profile.isRefetching
      }
      onRefresh={() => {
        void profile.refetch();
        if (tab !== "about") void current.refetch();
      }}
      onEndReached={() => {
        if (
          tab !== "about" &&
          current.hasNextPage &&
          !current.isFetching &&
          !current.isFetchNextPageError
        )
          void current.fetchNextPage({ cancelRefetch: false });
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        tab !== "about" ? (
          current.isFetchingNextPage ? (
            <ActivityIndicator style={{ padding: 16 }} color={colors.brand} />
          ) : current.isFetchNextPageError ? (
            <ErrorNotice
              error={current.error}
              retry={() => {
                void current.fetchNextPage();
              }}
            />
          ) : null
        ) : null
      }
    />
  );
}
