import { t } from "../store/language";
import { useState } from "react";
import { Alert, Modal, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Post, Visibility } from "../api/types";
import { recipesApi } from "../api/recipes";
import { useSession } from "../store/session";
import { Avatar, Button, ErrorNotice, IconButton, useUI } from "./ui";
import { AudiencePicker } from "./AudiencePicker";
import { SharedPostPreview } from "./SharedPostPreview";
export function SharePostModal({
  post,
  onClose,
}: {
  post: Post;
  onClose: () => void;
}) {
  const { styles, colors } = useUI();
  const user = useSession((s) => s.user!);
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => recipesApi.share(post.id, content, visibility),
    onSuccess: async ({ post: result }) => {
      await Promise.all(
        [
          "feed",
          "savedPosts",
          "searchPosts",
          "profilePosts",
          "profile",
          "post",
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
      onClose();
      Alert.alert(
        result.status === "FLAGGED"
          ? t("Share submitted for review")
          : t("Shared to your feed"),
      );
    },
  });
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <SafeAreaView
        style={[styles.screen, { backgroundColor: colors.surface }]}
      >
        <View style={[styles.row, { padding: 12 }]}>
          <IconButton
            name="close"
            label={t("Close share")}
            disabled={mutation.isPending}
            onPress={onClose}
          />
          <Text style={[styles.heading, { flex: 1 }]}>{t("Share post")}</Text>
          <Button
            title={t("Share now")}
            loading={mutation.isPending}
            onPress={() => mutation.mutate()}
          />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={[styles.row, { padding: 16 }]}>
            <Avatar user={user} />
            <View style={{ gap: 5 }}>
              <Text style={styles.heading}>{user.name}</Text>
              <AudiencePicker
                value={visibility}
                onChange={setVisibility}
                disabled={mutation.isPending}
              />
            </View>
          </View>
          <TextInput
            accessibilityLabel={t("Say something about this post")}
            placeholder={t("Say something about this…")}
            placeholderTextColor={colors.muted}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={2000}
            editable={!mutation.isPending}
            style={[
              styles.body,
              { padding: 16, minHeight: 110, textAlignVertical: "top" },
            ]}
          />
          <SharedPostPreview
            post={post.isRepost ? (post.sharedPost ?? null) : post}
          />
          {mutation.isError && <ErrorNotice error={mutation.error} />}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
