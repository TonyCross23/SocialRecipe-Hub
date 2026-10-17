import { t } from "../store/language";
import { Image, ScrollView, Text, View } from "react-native";
import type { useMedia } from "../hooks/useMedia";
import { Button, useUI } from "./ui";
import { registrationUploadConfigured, uploadConfigured } from "../api/media";

export function MediaPicker({
  media,
  disabled = false,
  max = 10,
  registration = false,
}: {
  media: ReturnType<typeof useMedia>;
  disabled?: boolean;
  max?: number;
  registration?: boolean;
}) {
  const { styles } = useUI();

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.muted}>
        {media.images.length}/{max} {t("photos · optional")}
      </Text>
      <View style={styles.row}>
        <Button
          title={t("Gallery")}
          secondary
          disabled={disabled || media.picking || media.images.length >= max}
          onPress={() => {
            void media.pick("gallery");
          }}
        />
        <Button
          title={t("Camera")}
          secondary
          disabled={disabled || media.picking || media.images.length >= max}
          onPress={() => {
            void media.pick("camera");
          }}
        />
      </View>
      {!(registration ? registrationUploadConfigured : uploadConfigured) && (
        <Text style={styles.muted}>
          {registration
            ? t(
                "Profile photos will be available soon. You can join without a photo.",
              )
            : t(
                "Photo uploads will be available soon. You can share a text-only post.",
              )}
        </Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {media.images.map((image, index) => (
          <View key={image.uri} style={{ gap: 8 }}>
            <Image
              source={{ uri: image.uri }}
              accessibilityLabel={t(`Selected photo ${index + 1}`)}
              style={{ width: 140, height: 140, borderRadius: 14 }}
            />
            <Button
              title={t(`Remove ${index + 1}`)}
              secondary
              disabled={disabled}
              onPress={() => media.remove(image.uri)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
