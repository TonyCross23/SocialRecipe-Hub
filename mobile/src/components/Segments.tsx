import { t } from "../store/language";
import { Pressable, Text, View } from "react-native";
import { useUI } from "./ui";
export function Segments<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useUI();
  return (
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      {items.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === item.value }}
          onPress={() => onChange(item.value)}
          style={{
            paddingHorizontal: 17,
            paddingVertical: 10,
            borderRadius: 24,
            backgroundColor:
              value === item.value ? colors.pale : colors.surface,
            borderWidth: 1,
            borderColor: value === item.value ? colors.pale : colors.border,
          }}
        >
          <Text
            style={{
              color: value === item.value ? colors.brand : colors.ink,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {t(item.label)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
