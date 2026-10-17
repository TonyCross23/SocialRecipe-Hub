import { t } from "../store/language";
import {
  RecipeEditor,
  parseRecipeDraft,
  recipeDraft,
  type RecipeDraft,
} from "../components/RecipeEditor";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePreventRemove } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RootStackParams } from "../navigation/types";
import { recipesApi } from "../api/recipes";
import { uploadImage } from "../api/media";
import { useMedia } from "../hooks/useMedia";
import { postDraftSchema, postTitle, errorMessage } from "../lib/validation";
import { AudiencePicker } from "../components/AudiencePicker";
import { SharedPostPreview } from "../components/SharedPostPreview";
import {
  Avatar,
  Button,
  ErrorNotice,
  Field,
  IconButton,
  useUI,
} from "../components/ui";
export function EditPostScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParams, "EditPost">) {
  const { post } = route.params;
  const { styles, colors } = useUI();
  const client = useQueryClient();
  const [recipe, setRecipe] = useState<RecipeDraft | null>(
    post.recipe ? recipeDraft(post.recipe) : null,
  );
  const [content, setContent] = useState(post.content);
  const [images, setImages] = useState(post.images);
  const [visibility, setVisibility] = useState(post.visibility);
  const [title, setTitle] = useState(post.title);
  const [progress, setProgress] = useState("");
  const [saved, setSaved] = useState(false);
  const media = useMedia(post.isRepost ? 0 : Math.max(0, 10 - images.length));
  const uploaded = useRef(new Map<string, string>());
  const explicitTitle =
    !post.isRepost &&
    post.title !== "Kitchen update" &&
    !post.content.trim().startsWith(post.title);
  const mutation = useMutation({
    mutationFn: async () => {
      const resolved = post.isRepost
        ? "Shared post"
        : postTitle(explicitTitle ? title : "", content);
      if (!post.isRepost)
        postDraftSchema.parse({
          title: resolved,
          content,
          photoCount: images.length + media.images.length,
          visibility,
        });
      else if (content.trim().length > 2000)
        throw new Error("Use at most 2000 characters for a share caption.");
      const details = recipe ? parseRecipeDraft(recipe) : null;
      const nextImages = [...images];
      for (const [i, asset] of media.images.entries()) {
        setProgress(`Uploading photo ${i + 1} of ${media.images.length}…`);
        let url = uploaded.current.get(asset.uri);
        if (!url) {
          url = await uploadImage(asset);
          uploaded.current.set(asset.uri, url);
        }
        nextImages.push(url);
      }
      setProgress("Saving changes…");
      return recipesApi.editPost(post.id, {
        title: resolved,
        content,
        images: nextImages,
        visibility,
        expectedUpdatedAt: post.updatedAt,
        recipe: details,
      });
    },
    onSuccess: async ({ post: updated }) => {
      client.setQueryData(["post", updated.id], { post: updated });
      await Promise.all(
        [
          "savedPosts",
          "feed",
          "searchPosts",
          "profilePosts",
          "post",
          "profile",
          "people",
          "searchUsers",
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
      setSaved(true);
      if (updated.status === "FLAGGED")
        Alert.alert(t("Changes saved"), t("Your post is awaiting review."));
    },
    onError: (error) =>
      Alert.alert(t("Could not save changes"), errorMessage(error)),
    onSettled: () => setProgress(""),
  });
  usePreventRemove(mutation.isPending && !saved, () =>
    Alert.alert(
      t("Saving changes"),
      t("Please wait for your post to finish saving."),
    ),
  );
  useEffect(() => {
    if (saved) navigation.goBack();
  }, [saved, navigation]);
  const total = images.length + media.images.length;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.surface }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.row,
            { padding: 12, borderBottomWidth: 0.5, borderColor: colors.border },
          ]}
        >
          <IconButton
            name="close"
            label={t("Cancel editing")}
            disabled={mutation.isPending}
            onPress={() => navigation.goBack()}
          />
          <Text style={[styles.heading, { flex: 1 }]}>{t("Edit post")}</Text>
          <Button
            title={t("Save")}
            loading={mutation.isPending}
            disabled={media.picking}
            onPress={() => mutation.mutate()}
          />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View style={[styles.row, { padding: 16 }]}>
            <Avatar user={post.author} />
            <View style={{ gap: 6, flex: 1 }}>
              <Text style={styles.heading}>{post.author.name}</Text>
              <AudiencePicker
                value={visibility}
                onChange={setVisibility}
                disabled={mutation.isPending}
              />
            </View>
          </View>
          {explicitTitle && (
            <View style={{ paddingHorizontal: 16 }}>
              <Field
                label={t("Recipe title")}
                value={title}
                onChangeText={setTitle}
                maxLength={200}
                editable={!mutation.isPending}
              />
            </View>
          )}
          <TextInput
            accessibilityLabel={t("Edit post text")}
            placeholder={t("What’s on your mind?")}
            placeholderTextColor={colors.muted}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={post.isRepost ? 2000 : 20000}
            editable={!mutation.isPending}
            style={[
              styles.body,
              {
                padding: 16,
                minHeight: 200,
                textAlignVertical: "top",
                fontSize: 20,
              },
            ]}
          />
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              padding: 12,
            }}
          >
            {[
              ...images.map((uri) => ({ uri, existing: true })),
              ...media.images.map(({ uri }) => ({ uri, existing: false })),
            ].map((image, i) => (
              <View
                key={`${image.uri}-${i}`}
                style={{ width: total === 1 ? "100%" : "48%" }}
              >
                <Image
                  source={{ uri: image.uri }}
                  accessibilityLabel={t(`Post photo ${i + 1}`)}
                  style={{ width: "100%", height: 180, borderRadius: 10 }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(`Remove photo ${i + 1}`)}
                  disabled={mutation.isPending}
                  onPress={() =>
                    image.existing
                      ? setImages((items) =>
                          items.filter((uri) => uri !== image.uri),
                        )
                      : media.remove(image.uri)
                  }
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    padding: 8,
                    borderRadius: 20,
                    backgroundColor: "#00000099",
                  }}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                </Pressable>
              </View>
            ))}
          </View>
          {post.isRepost && (
            <SharedPostPreview post={post.sharedPost ?? null} />
          )}
          {!post.isRepost && (
            <RecipeEditor
              value={recipe}
              onChange={setRecipe}
              disabled={mutation.isPending}
            />
          )}
          {mutation.isError && (
            <ErrorNotice error={new Error(errorMessage(mutation.error))} />
          )}
          {!!progress && (
            <Text
              style={[styles.muted, { padding: 16 }]}
              accessibilityLiveRegion="polite"
            >
              {progress}
            </Text>
          )}
        </ScrollView>
        {!post.isRepost && (
          <View
            style={[
              styles.row,
              {
                padding: 16,
                borderTopWidth: 0.5,
                borderColor: colors.border,
                flexWrap: "wrap",
              },
            ]}
          >
            {(
              [
                {
                  source: "gallery",
                  icon: "images",
                  label: t("Photo / gallery"),
                },
                { source: "camera", icon: "camera", label: t("Camera") },
              ] as const
            ).map((item) => (
              <Pressable
                key={item.source}
                accessibilityRole="button"
                disabled={mutation.isPending || media.picking || total >= 10}
                onPress={() => {
                  void media.pick(item.source);
                }}
                style={[
                  styles.row,
                  {
                    flexGrow: 1,
                    minHeight: 44,
                    opacity: mutation.isPending || total >= 10 ? 0.4 : 1,
                  },
                ]}
              >
                <Ionicons name={item.icon} size={24} color={colors.brand} />
                <Text style={styles.body}>{t(item.label)}</Text>
              </Pressable>
            ))}
            <Text style={styles.muted}>
              {total}
              {t("/10 photos")}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
