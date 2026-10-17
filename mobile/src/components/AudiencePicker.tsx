import { t } from "../store/language";
import { Alert, Pressable, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Visibility } from "../api/types";
import { useUI } from "./ui";
export function AudiencePicker({
  value,
  onChange,
  disabled,
}: {
  value: Visibility;
  onChange: (value: Visibility) => void;
  disabled?: boolean;
}) {
  const { colors } = useUI();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("Choose post audience")}
      disabled={disabled}
      onPress={() =>
        Alert.alert(t("Who can see your post?"), t("Choose an audience"), [
          { text: t("🌐 Public"), onPress: () => onChange("PUBLIC") },
          { text: t("👥 Followers"), onPress: () => onChange("FOLLOWERS") },
          { text: t("🔒 Only me"), onPress: () => onChange("PRIVATE") },
          { text: t("Cancel"), style: "cancel" },
        ])
      }
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        alignSelf: "flex-start",
        backgroundColor: colors.background,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 5,
      }}
    >
      <Ionicons
        name={
          value === "PUBLIC"
            ? "earth"
            : value === "FOLLOWERS"
              ? "people"
              : "lock-closed"
        }
        size={13}
        color={colors.ink}
      />
      <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 13 }}>
        {value === "PUBLIC"
          ? t("Public")
          : value === "FOLLOWERS"
            ? t("Followers")
            : t("Only me")}
      </Text>
      <Ionicons name="caret-down" size={12} color={colors.ink} />
    </Pressable>
  );
}
