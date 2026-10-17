import { t } from "../store/language";
import { useRef, useState, type ComponentProps } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUI } from "./ui";
export interface MenuAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface DropdownAction {
  text: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  destructive?: boolean;
  onPress: () => void;
}
export function DropdownMenu({
  anchor,
  actions,
  onClose,
}: {
  anchor: MenuAnchor;
  actions: DropdownAction[];
  onClose: () => void;
}) {
  const { colors } = useUI();
  const window = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const root = useRef<View>(null);
  const [origin, setOrigin] = useState<{
    x: number;
    y: number;
    height: number;
  } | null>(null);
  const width = Math.min(260, window.width - safe.left - safe.right - 24);
  const availableHeight = Math.max(
    48,
    (origin?.height ?? window.height) - safe.top - safe.bottom - 24,
  );
  const height = Math.min(actions.length * 52 + 12, availableHeight);
  const x = anchor.x - (origin?.x ?? 0);
  const y = anchor.y - (origin?.y ?? 0);
  const left = Math.max(
    safe.left + 12,
    Math.min(x + anchor.width - width, window.width - safe.right - width - 12),
  );
  const below = y + anchor.height + 6;
  const top = Math.max(
    safe.top + 12,
    Math.min(
      below + height <= (origin?.height ?? window.height) - safe.bottom - 12
        ? below
        : y - height - 6,
      (origin?.height ?? window.height) - safe.bottom - height - 12,
    ),
  );
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        ref={root}
        style={{ flex: 1 }}
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          root.current?.measureInWindow((x, y) => setOrigin({ x, y, height }));
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Close post options")}
          onPress={onClose}
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.12)",
          }}
        />
        {origin && (
          <View
            accessibilityViewIsModal
            accessibilityLabel={t("Post options")}
            style={{
              position: "absolute",
              left,
              top,
              width,
              maxHeight: height,
              borderRadius: 12,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 5,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 12,
            }}
          >
            <ScrollView bounces={false}>
              {actions.map((action) => (
                <Pressable
                  key={action.text}
                  accessibilityRole="button"
                  accessibilityLabel={t(action.text)}
                  onPress={() => {
                    onClose();
                    action.onPress();
                  }}
                  style={({ pressed }) => ({
                    minHeight: 52,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                    backgroundColor: pressed ? colors.pale : colors.surface,
                  })}
                >
                  <Ionicons
                    name={action.icon}
                    size={21}
                    color={action.destructive ? colors.danger : colors.ink}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: "600",
                      color: action.destructive ? colors.danger : colors.ink,
                    }}
                  >
                    {t(action.text)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}
