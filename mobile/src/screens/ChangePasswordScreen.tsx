import { t } from "../store/language";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recipesApi } from "../api/recipes";
import { useSession } from "../store/session";
import { Button, ErrorNotice, Field, useUI } from "../components/ui";
export function ChangePasswordScreen() {
  const { styles } = useUI();
  const client = useQueryClient();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Enter your current password.");
      if (password.length < 12 || password.length > 128)
        throw new Error("Use 12–128 characters for your new password.");
      if (password !== confirm) throw new Error("New passwords do not match.");
      await recipesApi.changePassword(current, password);
    },
    onSuccess: async () => {
      setCurrent("");
      setPassword("");
      setConfirm("");
      await client.cancelQueries();
      client.clear();
      await useSession.getState().clear();
      Alert.alert(t("Password changed"), t("Sign in with your new password."));
    },
  });
  const props = {
    secureTextEntry: !show,
    autoCapitalize: "none" as const,
    autoCorrect: false,
    maxLength: 128,
    editable: !mutation.isPending,
  };
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 40 }}
      >
        <Text style={styles.muted}>
          {t(
            "Use 12–128 characters. You'll sign in again after changing your password.",
          )}
        </Text>
        <View style={{ gap: 18 }}>
          <Field
            label={t("Current password")}
            value={current}
            onChangeText={setCurrent}
            textContentType="password"
            {...props}
          />
          <Field
            label={t("New password")}
            value={password}
            onChangeText={setPassword}
            textContentType="newPassword"
            {...props}
          />
          <Field
            label={t("Confirm new password")}
            value={confirm}
            onChangeText={setConfirm}
            textContentType="newPassword"
            {...props}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={mutation.isPending}
          onPress={() => setShow((v) => !v)}
          style={{ alignSelf: "flex-start", paddingVertical: 8 }}
        >
          <Text style={styles.muted}>
            {show ? t("Hide passwords") : t("Show passwords")}
          </Text>
        </Pressable>
        {mutation.isError && <ErrorNotice error={mutation.error} />}
        <Button
          title={t("Update password")}
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
