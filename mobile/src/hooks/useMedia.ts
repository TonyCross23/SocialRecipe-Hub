import { t } from "../store/language";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking } from "react-native";
import { errorMessage } from "../lib/validation";

export type Media = ImagePicker.ImagePickerAsset;
export function useMedia(max = 10) {
  const [images, setImages] = useState<Media[]>([]);
  const [picking, setPicking] = useState(false);
  async function pick(source: "camera" | "gallery", replace = false) {
    if (picking || (!replace && images.length >= max)) return;
    setPicking(true);
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t("Permission needed"),
          t(
            source === "camera"
              ? "Allow camera access to add photos."
              : "Allow photo library access to add photos.",
          ),
          [
            { text: t("Cancel"), style: "cancel" },
            {
              text: t("Open settings"),
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ],
        );
        return;
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              quality: 0.8,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsMultipleSelection: max > 1,
              selectionLimit: replace ? max : max - images.length,
              quality: 0.8,
            });
      if (result.canceled) return;
      const valid = result.assets.filter(
        (asset) => !asset.fileSize || asset.fileSize <= 10 * 1024 * 1024,
      );
      if (valid.length !== result.assets.length)
        Alert.alert(t("Photo too large"), t("Choose photos under 10 MB each."));
      setImages((current) =>
        replace
          ? valid.slice(0, max)
          : [
              ...current,
              ...valid.filter(
                (asset) => !current.some((item) => item.uri === asset.uri),
              ),
            ].slice(0, max),
      );
    } catch (error) {
      Alert.alert(t("Could not open photos"), t(errorMessage(error)));
    } finally {
      setPicking(false);
    }
  }
  return {
    images,
    picking,
    pick,
    remove: (uri: string) =>
      setImages((items) => items.filter((item) => item.uri !== uri)),
    clear: () => setImages([]),
  };
}
