import { t, dateLocale } from "../store/language";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePreventRemove } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParams } from "../navigation/types";
import { useSession } from "../store/session";
import { recipesApi } from "../api/recipes";
import { useMedia } from "../hooks/useMedia";
import { uploadImage } from "../api/media";
import { dateOnly, errorMessage, registerSchema } from "../lib/validation";
import { Avatar, Button, ErrorNotice, Field, useUI } from "../components/ui";
const schema = registerSchema.pick({ name: true, dob: true, image: true });
export function EditProfileScreen({
  navigation,
}: NativeStackScreenProps<RootStackParams, "EditProfile">) {
  const { styles, colors } = useUI();
  const me = useSession((s) => s.user!);
  const [name, setName] = useState(me.name);
  const [dob, setDob] = useState(me.dob.slice(0, 10));
  const [image, setImage] = useState(me.image);
  const [showDate, setShowDate] = useState(false);
  const [saved, setSaved] = useState(false);
  const media = useMedia(1);
  const client = useQueryClient();
  const uploaded = useRef<{ uri: string; url: string } | null>(null);
  const selected = media.images[0];
  const mutation = useMutation({
    mutationFn: async () => {
      const input = schema.parse({ name, dob, image });
      let nextImage = input.image ?? null;
      if (selected) {
        if (uploaded.current?.uri !== selected.uri)
          uploaded.current = {
            uri: selected.uri,
            url: await uploadImage(selected),
          };
        nextImage = uploaded.current.url;
      }
      return recipesApi.updateProfile({
        name: input.name,
        dob: input.dob,
        image: nextImage,
      });
    },
    onSuccess: async ({ user }) => {
      useSession.getState().setUser(user);
      await client.invalidateQueries();
      setSaved(true);
    },
  });
  usePreventRemove(mutation.isPending && !saved, () =>
    Alert.alert(
      t("Saving profile"),
      t("Please wait for your changes to finish saving."),
    ),
  );
  useEffect(() => {
    if (saved) navigation.goBack();
  }, [saved, navigation]);
  const busy = mutation.isPending || media.picking;
  const photo = () =>
    Alert.alert(t("Profile photo"), undefined, [
      {
        text: t("Choose photo"),
        onPress: () => {
          void media.pick("gallery", true);
        },
      },
      {
        text: t("Take photo"),
        onPress: () => {
          void media.pick("camera", true);
        },
      },
      ...(image || selected
        ? [
            {
              text: t("Remove photo"),
              style: "destructive" as const,
              onPress: () => {
                setImage(null);
                media.clear();
              },
            },
          ]
        : []),
      { text: t("Cancel"), style: "cancel" },
    ]);
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Change profile photo")}
          disabled={busy}
          onPress={photo}
          style={{
            alignItems: "center",
            gap: 10,
            alignSelf: "center",
            padding: 8,
          }}
        >
          <View>
            <Avatar
              user={{
                name: name.trim() || me.name,
                image: selected?.uri ?? image,
              }}
              size={96}
            />
            <View
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                borderRadius: 16,
                padding: 6,
                backgroundColor: colors.action,
                borderWidth: 2,
                borderColor: colors.background,
              }}
            >
              <Ionicons name="camera" size={15} color="#fff" />
            </View>
          </View>
          <Text
            style={{ color: colors.brand, fontSize: 13, fontWeight: "600" }}
          >
            {t("Change photo")}
          </Text>
        </Pressable>
        <View style={{ gap: 18 }}>
          <Field
            label={t("Name")}
            value={name}
            onChangeText={setName}
            maxLength={100}
            autoComplete="name"
            editable={!busy}
          />
          <View style={{ gap: 6 }}>
            <Text style={styles.muted}>{t("Birthday")}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Choose birthday")}
              disabled={busy}
              onPress={() => setShowDate(true)}
              style={[
                styles.input,
                styles.row,
                { justifyContent: "space-between" },
              ]}
            >
              <Text style={styles.body}>
                {new Date(`${dob}T12:00:00`).toLocaleDateString(dateLocale(), {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={colors.muted}
              />
            </Pressable>
            <Text style={[styles.muted, { fontSize: 12 }]}>
              {t("Only you can see your birthday.")}
            </Text>
          </View>
          {showDate && (
            <DateTimePicker
              value={new Date(`${dob}T12:00:00`)}
              mode="date"
              minimumDate={new Date(1900, 0, 1)}
              maximumDate={new Date()}
              onChange={(event, date) => {
                if (Platform.OS !== "ios" || event.type === "dismissed")
                  setShowDate(false);
                if (date) setDob(dateOnly(date));
              }}
            />
          )}
          <View style={{ gap: 5 }}>
            <Text style={styles.muted}>{t("Email")}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>
              {me.email}
            </Text>
          </View>
        </View>
        {mutation.isError && (
          <ErrorNotice error={new Error(errorMessage(mutation.error))} />
        )}
        <Button
          title={t("Save changes")}
          loading={mutation.isPending}
          disabled={media.picking}
          onPress={() => mutation.mutate()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
