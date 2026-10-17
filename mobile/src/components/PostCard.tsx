import { t } from "../store/language";
import { libraryApi } from "../api/library";
import { useSafety } from "../hooks/useSafety";
import {
  DropdownMenu,
  type DropdownAction,
  type MenuAnchor,
} from "./DropdownMenu";
import { useSession } from "../store/session";
import { RelativeTime } from "./RelativeTime";
import { SharePostModal } from "./SharePostModal";
import { SharedPostPreview } from "./SharedPostPreview";
import { useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Post } from "../api/types";
import type { RootStackParams } from "../navigation/types";
import { recipesApi } from "../api/recipes";
import { Avatar, IconButton, ErrorNotice, useUI } from "./ui";
import { FollowButton } from "./FollowButton";
import { ReportModal } from "./ReportModal";
export function PostCard({ post }: { post: Post }) {
  const { styles, colors } = useUI();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const client = useQueryClient();
  const route = useRoute();
  const user = useSession((s) => s.user!);
  const own = post.author.id === user.id;
  const screenWidth = useWindowDimensions().width;
  const [width, setWidth] = useState(screenWidth);
  const [reporting, setReporting] = useState(false);
  const [photo, setPhoto] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const optionsAnchor = useRef<View>(null);
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const refresh = () =>
    Promise.all(
      [
        "savedPosts",
        "feed",
        "searchPosts",
        "profilePosts",
        "postLikes",
        "post",
        "profile",
        "people",
        "searchUsers",
      ].map((key) => client.invalidateQueries({ queryKey: [key] })),
    );
  const like = useMutation({
    mutationFn: (liked: boolean) => recipesApi.like(post.id, liked),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => recipesApi.deletePost(post.id),
    onSuccess: async () => {
      if (route.name === "Post" && navigation.canGoBack()) navigation.goBack();
      client.removeQueries({ queryKey: ["post", post.id], exact: true });
      await refresh();
    },
    onError: (error) =>
      Alert.alert(
        t("Could not delete post"),
        error instanceof Error ? error.message : t("Please try again."),
      ),
  });
  function options() {
    if (remove.isPending) return;
    optionsAnchor.current?.measureInWindow((x, y, width, height) => {
      if (width && height) setMenu({ x, y, width, height });
    });
  }
  const save = useMutation({
    mutationFn: () => libraryApi.save(post.id, !post.savedByCurrentUser),
    onSuccess: refresh,
    onError: (error) =>
      Alert.alert(
        t("Could not save post"),
        error instanceof Error ? error.message : t("Please try again."),
      ),
  });
  const safety = useSafety(post.author.id, () => {
    if (route.name === "Post" && navigation.canGoBack()) navigation.goBack();
  });
  const ownerActions: DropdownAction[] = own
    ? [
        ...(user.permissions.includes("post:update:own") &&
        post.status !== "BANNED"
          ? [
              {
                text: t("Edit post"),
                icon: "create-outline" as const,
                onPress: () => navigation.push("EditPost", { post }),
              },
            ]
          : []),
        ...(user.permissions.includes("post:delete:own")
          ? [
              {
                text: t("Delete post"),
                icon: "trash-outline" as const,
                destructive: true,
                onPress: () =>
                  Alert.alert(
                    t("Delete this post?"),
                    t(
                      "It will be removed from your profile and the community feed.",
                    ),
                    [
                      { text: t("Cancel"), style: "cancel" },
                      {
                        text: t("Delete"),
                        style: "destructive",
                        onPress: () => remove.mutate(),
                      },
                    ],
                  ),
              },
            ]
          : []),
      ]
    : [
        {
          text: t("Report post"),
          icon: "flag-outline",
          onPress: () => setReporting(true),
        },
      ];
  const actions: DropdownAction[] = [
    {
      text: post.savedByCurrentUser ? "Unsave post" : "Save post",
      icon: post.savedByCurrentUser ? "bookmark" : "bookmark-outline",
      onPress: () => {
        if (!save.isPending) save.mutate();
      },
    },
    ...ownerActions,
    ...(!own
      ? [
          {
            text: t("Mute author"),
            icon: "volume-mute-outline" as const,
            onPress: () => safety.confirm("MUTE", post.author.name),
          },
          {
            text: t("Block author"),
            icon: "ban-outline" as const,
            destructive: true,
            onPress: () => safety.confirm("BLOCK", post.author.name),
          },
        ]
      : []),
  ];
  const liked = like.isPending ? like.variables : post.likedByCurrentUser;
  const content =
    post.content.length > 400 && !expanded
      ? post.content.slice(0, 400) + "…"
      : post.content;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 10,
        overflow: "hidden",
        borderWidth: 0.5,
        borderColor: colors.border,
      }}
    >
      <View style={[styles.row, { padding: 14 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`${post.author.name}'s profile`)}
          onPress={() => navigation.push("UserProfile", { user: post.author })}
        >
          <Avatar user={post.author} size={42} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              columnGap: 4,
            }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                navigation.push("UserProfile", { user: post.author })
              }
              style={{ flexShrink: 1, minWidth: 0 }}
            >
              <Text
                numberOfLines={2}
                style={[
                  styles.body,
                  { fontWeight: "700", fontSize: 15, lineHeight: 20 },
                ]}
              >
                {post.author.name}
              </Text>
            </Pressable>
            <FollowButton userId={post.author.id} inline />
          </View>
          {post.isRepost && (
            <Text style={[styles.muted, { fontSize: 12 }]}>
              {t("shared a post")}
            </Text>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={styles.muted}>
              <RelativeTime value={post.createdAt} /> ·
            </Text>
            <Ionicons
              name={
                post.visibility === "PRIVATE"
                  ? "lock-closed"
                  : post.visibility === "FOLLOWERS"
                    ? "people"
                    : "earth"
              }
              size={12}
              color={colors.muted}
            />
          </View>
        </View>
        {actions.length > 0 && (
          <View ref={optionsAnchor} collapsable={false}>
            <IconButton
              name="ellipsis-horizontal"
              label={t("Post options")}
              disabled={remove.isPending}
              onPress={options}
            />
          </View>
        )}
      </View>
      <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 6 }}>
        {!post.isRepost &&
          post.title !== "Kitchen update" &&
          !post.content.trim().startsWith(post.title) && (
            <Text style={[styles.heading, { fontSize: 18 }]}>{post.title}</Text>
          )}
        {!!content && <Text style={styles.body}>{content}</Text>}
        {post.content.length > 400 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setExpanded(!expanded)}
          >
            <Text style={{ color: colors.muted, fontWeight: "700" }}>
              {expanded ? t("See less") : t("See more")}
            </Text>
          </Pressable>
        )}
      </View>
      {post.isRepost && <SharedPostPreview post={post.sharedPost ?? null} />}
      {!!post.images.length && (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setPhoto(Math.round(e.nativeEvent.contentOffset.x / width))
            }
          >
            {post.images.map((uri, index) => (
              <Image
                key={`${uri}-${index}`}
                source={{ uri }}
                accessibilityLabel={t(
                  `Photo ${index + 1} of ${post.images.length}`,
                )}
                style={{
                  width: Math.max(1, width - 1),
                  height: Math.min(width, 380),
                }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          {post.images.length > 1 && (
            <View
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                backgroundColor: "#00000088",
                borderRadius: 16,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                {photo + 1}/{post.images.length}
              </Text>
            </View>
          )}
        </View>
      )}
      <View
        style={[
          styles.row,
          {
            justifyContent: "space-between",
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexWrap: "wrap",
            rowGap: 8,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("View people who liked this post")}
          onPress={() => navigation.push("Likes", { postId: post.id })}
          style={styles.row}
        >
          <Ionicons name="heart" color={colors.danger} size={17} />
          <Text style={styles.muted}>{post.likesCount}</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.push("Comments", { postId: post.id })}
        >
          <Text style={styles.muted}>
            {post.commentsCount} {t("comments ·")}
            {post.sharesCount} {t("shares")}
          </Text>
        </Pressable>
      </View>
      <View style={[styles.divider, { marginHorizontal: 14 }]} />
      <View style={{ flexDirection: "row" }}>
        {(
          [
            {
              label: liked ? "Liked" : "Like",
              icon: liked ? "heart" : "heart-outline",
              active: liked,
              disabled: like.isPending,
              action: () => like.mutate(!post.likedByCurrentUser),
            },
            {
              label: t("Comment"),
              icon: "chatbubble-outline",
              action: () => navigation.push("Comments", { postId: post.id }),
            },
            {
              label: t("Share"),
              icon: "arrow-redo-outline",
              disabled: post.isRepost
                ? !post.sharedPost || post.sharedPost.visibility !== "PUBLIC"
                : post.visibility !== "PUBLIC" || post.status !== "PUBLISHED",
              action: () => {
                setSharing(true);
              },
            },
          ] as const
        ).map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={t(action.label)}
            disabled={"disabled" in action && action.disabled}
            onPress={action.action}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 48,
              flexDirection: "row",
              gap: 5,
              paddingHorizontal: 4,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.pale : colors.surface,
            })}
          >
            <Ionicons
              name={action.icon}
              size={20}
              color={
                "active" in action && action.active
                  ? colors.danger
                  : colors.muted
              }
            />
            <Text
              style={{
                fontWeight: "600",
                fontSize: 13,
                color:
                  "active" in action && action.active
                    ? colors.danger
                    : colors.muted,
              }}
            >
              {t(action.label)}
            </Text>
          </Pressable>
        ))}
      </View>
      {post.recipe && route.name !== "Post" && (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.push("Post", { postId: post.id })}
          style={{ paddingHorizontal: 14, paddingVertical: 10 }}
        >
          <Text style={{ color: colors.brand, fontWeight: "600" }}>
            {t("View recipe ·")}{" "}
            {post.recipe.prepMinutes + post.recipe.cookMinutes} {t("min ·")}
            {post.recipe.servings} {t("servings")}
          </Text>
        </Pressable>
      )}
      {menu && (
        <DropdownMenu
          anchor={menu}
          actions={actions}
          onClose={() => setMenu(null)}
        />
      )}
      {sharing && (
        <SharePostModal post={post} onClose={() => setSharing(false)} />
      )}
      {like.isError && <ErrorNotice error={like.error} />}
      {reporting && (
        <ReportModal
          target={{ postId: post.id }}
          onClose={() => setReporting(false)}
        />
      )}
    </View>
  );
}
