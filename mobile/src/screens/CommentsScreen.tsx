import { t } from "../store/language";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RelativeTime } from "../components/RelativeTime";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParams } from "../navigation/types";
import type { Comment, ReportTarget } from "../api/types";
import { recipesApi } from "../api/recipes";
import {
  Avatar,
  Button,
  ErrorNotice,
  IconButton,
  useUI,
} from "../components/ui";
import { ReportModal } from "../components/ReportModal";
import { useSession } from "../store/session";
function CommentBubble({
  item,
  postId,
  onReport,
  onProfile,
}: {
  item: Comment;
  postId: string;
  onReport: () => void;
  onProfile: () => void;
}) {
  const { styles, colors } = useUI();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (liked: boolean) =>
      recipesApi.likeComment(postId, item.id, liked),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["comments", postId] }),
  });
  const liked = mutation.isPending
    ? mutation.variables
    : item.likedByCurrentUser;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 9 }}>
      <Pressable onPress={onProfile}>
        <Avatar user={item.author} size={36} />
      </Pressable>
      <View style={{ flex: 1, gap: 5 }}>
        <Pressable
          onLongPress={onReport}
          accessibilityHint="Long press to report comment"
          style={{
            borderRadius: 18,
            backgroundColor: colors.background,
            paddingHorizontal: 13,
            paddingVertical: 9,
            alignSelf: "flex-start",
            maxWidth: "100%",
          }}
        >
          <Pressable onPress={onProfile}>
            <Text style={[styles.body, { fontWeight: "700", fontSize: 14 }]}>
              {item.author.name}
            </Text>
          </Pressable>
          <Text style={styles.body}>{item.content}</Text>
        </Pressable>
        <View
          style={[
            styles.row,
            { paddingHorizontal: 8, gap: 12, flexWrap: "wrap" },
          ]}
        >
          <Text style={[styles.muted, { fontSize: 11 }]}>
            <RelativeTime value={item.createdAt} />
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={liked ? t("Unlike comment") : t("Like comment")}
            accessibilityState={{ selected: liked }}
            disabled={mutation.isPending}
            onPress={() => mutation.mutate(!item.likedByCurrentUser)}
          >
            <Text
              style={{
                color: liked ? colors.danger : colors.muted,
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              {t("Like")}
            </Text>
          </Pressable>
          {item.likesCount > 0 && (
            <Text style={styles.muted}>♥ {item.likesCount}</Text>
          )}
          <Pressable accessibilityRole="button" onPress={onReport}>
            <Text style={[styles.muted, { fontSize: 11 }]}>{t("Report")}</Text>
          </Pressable>
        </View>
        {mutation.isError && <ErrorNotice error={mutation.error} />}
      </View>
    </View>
  );
}
export function CommentsScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParams, "Comments">) {
  const { styles, colors } = useUI();
  const { postId } = route.params;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const list = useRef<FlatList<Comment>>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const user = useSession((s) => s.user!);
  const client = useQueryClient();
  const [text, setText] = useState("");
  const [report, setReport] = useState<ReportTarget | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["comments", postId],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      recipesApi.comments(postId, pageParam, signal),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
  });
  const mutation = useMutation({
    mutationFn: () => recipesApi.comment(postId, text.trim()),
    onSuccess: async () => {
      setText("");
      list.current?.scrollToOffset({ offset: 0, animated: true });
      await Promise.all(
        [
          "comments",
          "feed",
          "savedPosts",
          "searchPosts",
          "profilePosts",
          "post",
        ].map((key) =>
          client.invalidateQueries({
            queryKey: key === "comments" ? [key, postId] : [key],
          }),
        ),
      );
    },
  });
  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Close comments")}
        onPress={() => {
          Keyboard.dismiss();
          navigation.goBack();
        }}
        style={[StyleSheet.absoluteFill, { backgroundColor: "#00000077" }]}
      />
      <KeyboardAvoidingView
        pointerEvents="box-none"
        style={{
          flex: 1,
          justifyContent: "flex-end",
          alignItems: "center",
          paddingTop: insets.top + 8,
        }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 680,
            height: Math.min(height * 0.88, 820),
            maxHeight: "96%",
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: "hidden",
            paddingBottom: keyboardOpen ? 0 : insets.bottom,
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              alignSelf: "center",
              marginTop: 9,
            }}
          />
          <View
            style={[styles.row, { paddingHorizontal: 16, paddingVertical: 10 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.heading}>
                {t("Comments")}
                {query.data
                  ? t(` · ${query.data.pages[0].pagination.total}`)
                  : ""}
              </Text>
              <Text style={styles.muted}>{t("Newest first")}</Text>
            </View>
            <IconButton
              name="close"
              label={t("Close comments")}
              onPress={() => {
                Keyboard.dismiss();
                navigation.goBack();
              }}
            />
          </View>
          <View style={styles.divider} />
          <FlatList
            ref={list}
            style={{ flex: 1, minHeight: 0 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            contentContainerStyle={[
              styles.content,
              { gap: 18, paddingBottom: 16, flexGrow: 1 },
            ]}
            data={query.data?.pages.flatMap((p) => p.data) ?? []}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              query.isError ? (
                <ErrorNotice
                  error={query.error}
                  retry={() => {
                    void query.refetch();
                  }}
                />
              ) : undefined
            }
            renderItem={({ item }) => (
              <CommentBubble
                item={item}
                postId={postId}
                onReport={() => setReport({ commentId: item.id })}
                onProfile={() =>
                  navigation.push("UserProfile", { user: item.author })
                }
              />
            )}
            ListEmptyComponent={
              query.isPending ? (
                <ActivityIndicator
                  color={colors.brand}
                  style={{ marginTop: 28 }}
                />
              ) : !query.isError ? (
                <View
                  style={{ alignItems: "center", gap: 8, paddingVertical: 32 }}
                >
                  <Ionicons
                    name="chatbubbles-outline"
                    size={38}
                    color={colors.muted}
                  />
                  <Text style={styles.heading}>{t("No comments yet")}</Text>
                  <Text style={styles.muted}>
                    {t("Write a comment below.")}
                  </Text>
                </View>
              ) : undefined
            }
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => {
              void query.refetch();
            }}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (query.hasNextPage && !query.isFetching)
                void query.fetchNextPage();
            }}
            ListFooterComponent={
              query.isFetchingNextPage ? (
                <ActivityIndicator />
              ) : query.hasNextPage ? (
                <Button
                  title={t("More comments")}
                  secondary
                  onPress={() => {
                    void query.fetchNextPage();
                  }}
                />
              ) : undefined
            }
          />
          {mutation.isError && <ErrorNotice error={mutation.error} />}
          <View
            style={[
              styles.row,
              {
                paddingHorizontal: 12,
                paddingVertical: 10,
                alignItems: "flex-end",
                borderTopWidth: 0.5,
                borderColor: colors.border,
              },
            ]}
          >
            <Avatar user={user} size={34} />
            <TextInput
              accessibilityLabel={t("Write a comment")}
              placeholder={t("Write a comment…")}
              placeholderTextColor={colors.muted}
              value={text}
              onChangeText={setText}
              maxLength={5000}
              multiline
              editable={!mutation.isPending}
              style={[
                styles.input,
                {
                  flex: 1,
                  minWidth: 0,
                  minHeight: 44,
                  borderRadius: 22,
                  backgroundColor: colors.background,
                  borderWidth: 0,
                  maxHeight: Math.max(60, Math.min(120, height * 0.18)),
                  paddingTop: 11,
                  paddingBottom: 11,
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Send comment")}
              disabled={!text.trim() || mutation.isPending}
              onPress={() => mutation.mutate()}
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                opacity: !text.trim() || mutation.isPending ? 0.4 : 1,
              }}
            >
              {mutation.isPending ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <Ionicons name="send" size={23} color={colors.brand} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      {report && (
        <ReportModal target={report} onClose={() => setReport(null)} />
      )}
    </View>
  );
}
