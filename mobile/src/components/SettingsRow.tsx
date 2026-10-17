import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useUI } from "./ui";
export function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { colors } = useUI();
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          color: colors.muted,
          fontSize: 12,
          fontWeight: "600",
          paddingHorizontal: 6,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 0.5,
          borderColor: colors.border,
        }}
      >
        {children}
      </View>
    </View>
  );
}
export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
  last = false,
  danger = false,
  disabled = false,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  last?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useUI();
  const content = (
    <>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={icon}
          size={19}
          color={danger ? colors.danger : colors.ink}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text
          style={{
            color: danger ? colors.danger : colors.ink,
            fontSize: 15,
            fontWeight: "500",
          }}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing !== undefined ? (
        trailing
      ) : onPress ? (
        <Ionicons name="chevron-forward" color={colors.muted} size={17} />
      ) : null}
    </>
  );
  const layout = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 60,
    borderBottomWidth: last ? 0 : 0.5,
    borderColor: colors.border,
    opacity: disabled ? 0.5 : 1,
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        layout,
        { backgroundColor: pressed ? colors.pale : colors.surface },
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={layout}>{content}</View>
  );
}
