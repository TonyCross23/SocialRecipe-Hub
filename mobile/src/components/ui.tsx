import { useLanguage, t } from "../store/language";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppearance } from "../store/appearance";
const light = {
  ink: "#17202A",
  muted: "#65676B",
  brand: "#0866FF",
  action: "#0866FF",
  pale: "#E7F0FF",
  background: "#F0F2F5",
  surface: "#FFFFFF",
  border: "#DEE2E7",
  danger: "#C73545",
  white: "#FFFFFF",
  cover: "#D9E8FC",
};
const dark = {
  ink: "#E4E6EB",
  muted: "#B0B3B8",
  brand: "#75B0FF",
  action: "#0866FF",
  pale: "#263951",
  background: "#18191A",
  surface: "#242526",
  border: "#3A3B3C",
  danger: "#FF8A98",
  white: "#FFFFFF",
  cover: "#243954",
};
export type Colors = typeof light;
function makeStyles(c: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: 12, gap: 12, paddingBottom: 32 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    title: { color: c.ink, fontSize: 26, fontWeight: "800" },
    heading: { color: c.ink, fontSize: 18, fontWeight: "700" },
    body: { color: c.ink, fontSize: 16, lineHeight: 24 },
    muted: { color: c.muted, fontSize: 13, lineHeight: 20 },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 13,
      color: c.ink,
      fontSize: 16,
      minHeight: 48,
    },
    button: {
      paddingHorizontal: 16,
      paddingVertical: 11,
      minHeight: 44,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.action,
    },
    secondary: { backgroundColor: c.pale },
    error: { color: c.danger, fontSize: 14, lineHeight: 22 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  });
}
const themes = {
  light: { colors: light, styles: makeStyles(light) },
  dark: { colors: dark, styles: makeStyles(dark) },
};
export function useUI() {
  useLanguage((s) => s.language);
  const mode = useAppearance((s) => s.mode);
  const device = useColorScheme();
  const isDark = mode === "dark" || (mode === "system" && device === "dark");
  return { ...themes[isDark ? "dark" : "light"], dark: isDark };
}
export function Button({
  title,
  onPress,
  disabled,
  loading,
  secondary,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: boolean;
  style?: ViewStyle;
}) {
  const { styles, colors } = useUI();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(title)}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        { opacity: disabled || loading ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.brand : colors.white} />
      ) : (
        <Text
          style={{
            color: secondary ? colors.brand : colors.white,
            fontWeight: "700",
            fontSize: 14,
          }}
        >
          {t(title)}
        </Text>
      )}
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  disabled = false,
}: {
  name: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useUI();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.pale : colors.background,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Ionicons name={name} color={colors.ink} size={22} />
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { styles, colors } = useUI();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.muted, { fontWeight: "600" }]}>{t(label)}</Text>
      <TextInput
        accessibilityLabel={t(label)}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 140, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Avatar({
  user,
  size = 44,
}: {
  user: { name: string; image: string | null };
  size?: number;
}) {
  const { colors } = useUI();
  return user.image ? (
    <Image
      accessibilityLabel={t(`${user.name}'s photo`)}
      source={{ uri: user.image }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.pale,
      }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.pale,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{ color: colors.brand, fontWeight: "800", fontSize: size / 3 }}
      >
        {user.name.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  const { styles } = useUI();
  return (
    <View
      style={[
        styles.card,
        { margin: 12, paddingVertical: 28, alignItems: "center" },
      ]}
    >
      <Text style={styles.heading}>{title}</Text>
      {children}
    </View>
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const { styles } = useUI();
  const issues =
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray(error.issues)
      ? error.issues
      : [];
  const detail = issues.length
    ? issues
        .map(
          (issue: {
            message?: string;
            code?: string;
            path?: (string | number)[];
          }) => {
            const field = issue.path
              ?.filter((p) => typeof p === "string")
              .at(-1);
            const labels: Record<string, string> = {
              email: "Email",
              name: "Name",
              password: "Password",
              confirmPassword: "Confirm password",
              dob: "Birthday",
              quantity: "Quantity",
              servings: "Servings",
              steps: "Steps",
            };
            const message =
              issue.message &&
              (issue.code === "custom" ||
                issue.message === "Use at least 12 characters" ||
                t(issue.message) !== issue.message)
                ? t(issue.message)
                : t(
                    issue.code === "too_small"
                      ? "Value is too short or too small"
                      : issue.code === "too_big"
                        ? "Value is too long or too large"
                        : "Check this value",
                  );
            return `${field ? t(labels[field] ?? "Input") + ": " : ""}${message}`;
          },
        )
        .join("\n")
    : error instanceof Error
      ? t(error.message)
      : t("Could not load. Please try again.");
  return (
    <View accessibilityRole="alert" style={{ gap: 10, padding: 12 }}>
      <Text style={styles.error}>{detail}</Text>
      {retry && <Button title={t("Try again")} secondary onPress={retry} />}
    </View>
  );
}
