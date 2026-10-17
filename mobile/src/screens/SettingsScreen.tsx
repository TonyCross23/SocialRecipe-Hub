import { t } from "../store/language";
import { LanguagePicker } from "../components/LanguagePicker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { RootStackParams } from "../navigation/types";
import {
  connectPush,
  disconnectPush,
  pushEnabled,
  pushSupported,
} from "../lib/push";
import { useAppearance } from "../store/appearance";
import { useSession } from "../store/session";
import { recipesApi } from "../api/recipes";
import { queryClient } from "../lib/query";
import { Avatar, ErrorNotice, useUI } from "../components/ui";
import { SettingsGroup, SettingsRow } from "../components/SettingsRow";
export function SettingsScreen() {
  const { styles, colors, dark } = useUI();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const user = useSession((s) => s.user!);
  const [notifications, setNotifications] = useState(false);
  const [busy, setBusy] = useState<"appearance" | "push" | "logout" | null>(
    null,
  );
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let mounted = true;
    void pushEnabled()
      .then((value) => {
        if (mounted) setNotifications(value);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);
  async function toggleDark(value: boolean) {
    setBusy("appearance");
    setError(null);
    try {
      await useAppearance.getState().setMode(value ? "dark" : "light");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }
  async function togglePush(value: boolean) {
    setBusy("push");
    setError(null);
    try {
      if (value) await connectPush(true);
      else await disconnectPush();
      setNotifications(value);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }
  async function logout() {
    setBusy("logout");
    setError(null);
    try {
      await recipesApi.logout();
      await queryClient.cancelQueries();
      queryClient.clear();
      await useSession.getState().clear();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }
  const switchProps = {
    trackColor: { true: colors.action, false: colors.border },
    thumbColor: "#fff",
  };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16, paddingBottom: 36, gap: 24 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("View your profile")}
        disabled={!!busy}
        onPress={() => nav.navigate("Tabs", { screen: "Profile" })}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingVertical: 6,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Avatar user={user} size={58} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={2}
            style={{ color: colors.ink, fontWeight: "700", fontSize: 19 }}
          >
            {user.name}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
            {t("View your profile")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={19} color={colors.muted} />
      </Pressable>
      <SettingsGroup title={t("Account")}>
        <SettingsRow
          icon="person-outline"
          title={t("Edit profile")}
          disabled={!!busy}
          onPress={() => nav.push("EditProfile")}
        />
        <SettingsRow
          icon="lock-closed-outline"
          title={t("Change password")}
          disabled={!!busy}
          last
          onPress={() => nav.push("ChangePassword")}
        />
      </SettingsGroup>
      <SettingsGroup title={t("Preferences")}>
        <SettingsRow
          icon="language-outline"
          title={t("App language")}
          trailing={<LanguagePicker />}
        />
        <SettingsRow
          icon="moon-outline"
          title={t("Dark mode")}
          trailing={
            <Switch
              accessibilityLabel={t("Dark mode")}
              value={dark}
              disabled={!!busy}
              onValueChange={(v) => {
                void toggleDark(v);
              }}
              {...switchProps}
            />
          }
        />
        <SettingsRow
          icon="notifications-outline"
          title={t("Push notifications")}
          last
          subtitle={
            !pushSupported ? "Available in the installed app" : undefined
          }
          trailing={
            busy === "push" ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <Switch
                accessibilityLabel={t("Push notifications")}
                value={notifications}
                disabled={!!busy || !pushSupported}
                onValueChange={(v) => {
                  void togglePush(v);
                }}
                {...switchProps}
              />
            )
          }
        />
      </SettingsGroup>
      <SettingsGroup title={t("Your kitchen")}>
        <SettingsRow
          icon="bookmark-outline"
          title={t("Saved recipes")}
          disabled={!!busy}
          onPress={() => nav.push("Saved")}
        />
        <SettingsRow
          icon="basket-outline"
          title={t("Shopping lists")}
          disabled={!!busy}
          last
          onPress={() => nav.push("ShoppingLists")}
        />
      </SettingsGroup>
      <SettingsGroup title={t("Privacy")}>
        <SettingsRow
          icon="shield-checkmark-outline"
          title={t("Blocked & muted users")}
          disabled={!!busy}
          last
          onPress={() => nav.push("Filters")}
        />
      </SettingsGroup>
      {error != null && <ErrorNotice error={error} />}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <SettingsRow
          icon="log-out-outline"
          title={t("Sign out")}
          last
          danger
          disabled={!!busy}
          trailing={
            busy === "logout" ? (
              <ActivityIndicator color={colors.danger} />
            ) : null
          }
          onPress={() =>
            Alert.alert(
              t("Sign out?"),
              t("You can sign in again with your email and password."),
              [
                { text: t("Cancel"), style: "cancel" },
                {
                  text: t("Sign out"),
                  style: "destructive",
                  onPress: () => {
                    void logout();
                  },
                },
              ],
            )
          }
        />
      </View>
    </ScrollView>
  );
}
