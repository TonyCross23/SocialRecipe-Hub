import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../store/language";
import {
  RecipeEditor,
  parseRecipeDraft,
  type RecipeDraft,
} from "../components/RecipeEditor";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { TabParams } from "../navigation/types";
import { useMedia } from "../hooks/useMedia";
import { uploadImage, uploadConfigured } from "../api/media";
import { recipesApi } from "../api/recipes";
import {
  errorMessage,
  postDraftSchema,
  postSchema,
  postTitle,
} from "../lib/validation";
import type { Visibility } from "../api/types";
import {
  Avatar,
  Button,
  ErrorNotice,
  IconButton,
  useUI,
} from "../components/ui";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AudiencePicker } from "../components/AudiencePicker";
import { useSession } from "../store/session";

export function CreatePostScreen() {
  const { styles, colors } = useUI();
  const insets = useSafeAreaInsets();

  const user = useSession((state) => state.user!);
  const navigation = useNavigation<BottomTabNavigationProp<TabParams>>();
  const client = useQueryClient();
  const [recipe, setRecipe] = useState<RecipeDraft | null>(null);
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [progress, setProgress] = useState("");
  const resolvedTitle = postTitle("", content);
  const [formError, setFormError] = useState<string | null>(null);
  const media = useMedia();
  const uploaded = useRef(new Map<string, string>());
  const publishing = useRef(false);
  const mutation = useMutation({
    mutationFn: async () => {
      if (recipe) parseRecipeDraft(recipe);
      // Validate before uploading; local URIs are never sent to the posts endpoint.
      postDraftSchema.parse({
        title: resolvedTitle,
        content,
        photoCount: media.images.length,
        visibility,
      });
      if (media.images.length && !uploadConfigured)
        throw new Error(
          "Photo upload is not configured. Remove photos to publish text only.",
        );
      const images: string[] = [];
      for (const [index, image] of media.images.entries()) {
        setProgress(`Uploading photo ${index + 1} of ${media.images.length}…`);
        let url = uploaded.current.get(image.uri);
        if (!url) {
          url = await uploadImage(image);
          uploaded.current.set(image.uri, url);
        }
        images.push(url);
      }
      setProgress("Publishing…");
      return recipesApi.createPost(
        postSchema.parse({
          title: resolvedTitle,
          content,
          images,
          visibility,
          recipe: recipe ? parseRecipeDraft(recipe) : null,
        }),
      );
    },
    onSuccess: async ({ post }) => {
      setFormError(null);
      setContent("");
      setRecipe(null);
      setVisibility("PUBLIC");
      media.clear();
      uploaded.current.clear();
      await Promise.all(
        ["feed", "searchPosts", "profilePosts", "profile"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
      Alert.alert(
        t("Post submitted"),
        post.status === "FLAGGED"
          ? t("Your post is awaiting moderation.")
          : t("Your recipe is ready for the community."),
      );
      navigation.navigate("Home");
    },
    onError: (error) => {
      Alert.alert(t("Post wasn't published"), errorMessage(error));
    },
    onSettled: () => {
      publishing.current = false;
      setProgress("");
    },
  });
  usePreventRemove(mutation.isPending, () => {
    Alert.alert(t("Publishing"), t("Please wait for publishing to finish."));
  });
  function publish() {
    if (publishing.current) return;
    mutation.reset();
    const draft = postDraftSchema.safeParse({
      title: resolvedTitle,
      content,
      photoCount: media.images.length,
      visibility,
    });
    if (!draft.success) {
      const message = errorMessage(draft.error);
      setFormError(message);
      Alert.alert(t("Check your post"), message);
      return;
    }
    setFormError(null);
    publishing.current = true;
    mutation.mutate();
  }
  const busy = mutation.isPending || media.picking;
  const canPost = !!content.trim() || media.images.length > 0;
  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 12,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 0.5,
          borderColor: colors.border,
        }}
      >
        <IconButton
          name="close"
          label={t("Back to feed")}
          disabled={mutation.isPending}
          onPress={() => navigation.navigate("Home")}
        />
        <Text
          style={{
            color: colors.ink,
            fontSize: 17,
            fontWeight: "700",
            flex: 1,
            textAlign: "center",
          }}
        >
          {t("New post")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Publish post")}
          disabled={busy || !canPost}
          onPress={publish}
          style={{
            minHeight: 42,
            minWidth: 64,
            paddingHorizontal: 10,
            justifyContent: "center",
            alignItems: "center",
            opacity: busy || !canPost ? 0.45 : 1,
          }}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <Text
              style={{ color: colors.brand, fontSize: 15, fontWeight: "700" }}
            >
              {t("Post")}
            </Text>
          )}
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 20,
          paddingBottom: 30,
          gap: 16,
          flexGrow: 1,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
          <Avatar user={user} size={42} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text
              style={{ color: colors.ink, fontSize: 15, fontWeight: "600" }}
            >
              {user.name}
            </Text>
            <AudiencePicker
              value={visibility}
              onChange={setVisibility}
              disabled={busy}
            />
          </View>
        </View>
        <TextInput
          accessibilityLabel={t("Write your post")}
          placeholder={t("Share a recipe or a kitchen moment…")}
          placeholderTextColor={colors.muted}
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={20000}
          editable={!busy}
          textAlignVertical="top"
          style={{
            color: colors.ink,
            fontSize: 18,
            lineHeight: 29,
            minHeight: recipe || media.images.length ? 130 : 200,
            paddingVertical: 8,
          }}
        />
        {!!media.images.length && (
          <View style={{ gap: 8 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
            >
              {media.images.map((image, index) => (
                <View key={image.uri} style={{ width: 160, height: 176 }}>
                  <Image
                    source={{ uri: image.uri }}
                    accessibilityLabel={t(`Selected photo ${index + 1}`)}
                    style={{ width: 160, height: 176, borderRadius: 12 }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(`Remove photo ${index + 1}`)}
                    disabled={busy}
                    onPress={() => media.remove(image.uri)}
                    style={{
                      position: "absolute",
                      right: 6,
                      top: 6,
                      backgroundColor: "rgba(0,0,0,0.6)",
                      borderRadius: 18,
                      padding: 7,
                    }}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Text style={styles.muted}>
              {media.images.length}/10 {t("photos")}
            </Text>
          </View>
        )}
        {recipe && (
          <RecipeEditor value={recipe} onChange={setRecipe} disabled={busy} />
        )}
        {mutation.isError && (
          <ErrorNotice error={new Error(errorMessage(mutation.error))} />
        )}
        {formError && <ErrorNotice error={new Error(formError)} />}
        {!!progress && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text accessibilityLiveRegion="polite" style={styles.muted}>
              {t(progress)}
            </Text>
          </View>
        )}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          paddingVertical: 10,
          paddingHorizontal: 18,
          gap: 8,
          borderTopWidth: 0.5,
          borderColor: colors.border,
        }}
      >
        {(
          [
            {
              key: "gallery",
              label: "Photos",
              icon: "images-outline",
              color: "#31A863",
            },
            {
              key: "camera",
              label: "Camera",
              icon: "camera-outline",
              color: colors.brand,
            },
            {
              key: "recipe",
              label: "Recipe",
              icon: "restaurant-outline",
              color: "#C58A26",
            },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={t(item.label)}
            disabled={
              busy || (item.key !== "recipe" && media.images.length >= 10)
            }
            onPress={() => {
              if (item.key === "recipe") {
                if (!recipe)
                  setRecipe({
                    servings: "2",
                    prepMinutes: "0",
                    cookMinutes: "0",
                    ingredients: [{ name: "", quantity: "", unit: "" }],
                    steps: "",
                  });
              } else void media.pick(item.key);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 48,
              flexDirection: "row",
              gap: 6,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              backgroundColor: pressed ? colors.pale : colors.surface,
              opacity: busy ? 0.45 : 1,
            })}
          >
            <Ionicons name={item.icon} size={21} color={item.color} />
            <Text
              style={{
                color: colors.ink,
                fontSize: 13,
                fontWeight: "500",
                flexShrink: 1,
              }}
            >
              {t(item.label)}
            </Text>
          </Pressable>
        ))}
      </View>
    </KeyboardAvoidingView>
  );
}
