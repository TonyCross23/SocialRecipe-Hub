import { Alert, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLanguage, t } from "../store/language";
import { useUI } from "./ui";
export function LanguagePicker() {
  const { colors } = useUI();
  const language = useLanguage((s) => s.language);
  const choose = (value: "en" | "my") => {
    void useLanguage
      .getState()
      .setLanguage(value)
      .catch(() => Alert.alert(t("Could not save language")));
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("App language")}
      onPress={() =>
        Alert.alert(t("App language"), undefined, [
          { text: "English", onPress: () => choose("en") },
          { text: "မြန်မာ", onPress: () => choose("my") },
          { text: t("Cancel"), style: "cancel" },
        ])
      }
      style={{ paddingVertical: 8, paddingHorizontal: 6 }}
    >
      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
        <Ionicons name="language-outline" color={colors.brand} size={18} />
        <Text style={{ color: colors.brand, fontSize: 13, fontWeight: "600" }}>
          {language === "my" ? "မြန်မာ" : "English"}
        </Text>
      </View>
    </Pressable>
  );
}
