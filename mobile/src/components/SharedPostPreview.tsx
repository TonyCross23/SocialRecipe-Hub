import { t } from "../store/language";
import { RelativeTime } from "./RelativeTime";
import { Image, Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParams } from "../navigation/types";
import type { Post } from "../api/types";
import { Avatar, useUI } from "./ui";
export function SharedPostPreview({ post }: { post: Post | null }) {
  const { styles, colors } = useUI();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  return (
    <View
      style={{
        margin: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {post ? (
        <>
          <Pressable
            onPress={() => nav.push("UserProfile", { user: post.author })}
            style={[styles.row, { padding: 12 }]}
          >
            <Avatar user={post.author} size={36} />
            <View>
              <Text style={[styles.body, { fontWeight: "700" }]}>
                {post.author.name}
              </Text>
              <Text style={styles.muted}>
                <RelativeTime value={post.createdAt} /> · 🌐
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => nav.push("Post", { postId: post.id })}
            accessibilityRole="button"
            accessibilityLabel={t("View original post")}
          >
            <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 6 }}>
              {post.title !== "Kitchen update" &&
                !post.content.startsWith(post.title) && (
                  <Text style={styles.heading}>{post.title}</Text>
                )}
              <Text numberOfLines={8} style={styles.body}>
                {post.content}
              </Text>
            </View>
            {!!post.images.length && (
              <Image
                source={{ uri: post.images[0] }}
                style={{ width: "100%", height: 220 }}
                resizeMode="cover"
              />
            )}
            {post.images.length > 1 && (
              <Text style={[styles.muted, { padding: 8 }]}>
                {post.images.length} {t("photos · View original post")}
              </Text>
            )}
          </Pressable>
        </>
      ) : (
        <View style={{ padding: 20 }}>
          <Text style={styles.heading}>{t("This post is unavailable")}</Text>
          <Text style={styles.muted}>
            {t("It may have been removed or its audience changed.")}
          </Text>
        </View>
      )}
    </View>
  );
}
