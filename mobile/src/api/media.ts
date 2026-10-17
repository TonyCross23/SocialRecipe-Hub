import { File } from "expo-file-system";
import { api } from "./client";
import { imageUrl } from "../lib/validation";
import type { Media } from "../hooks/useMedia";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export const uploadConfigured = Boolean(process.env.EXPO_PUBLIC_UPLOAD_PATH);
export const registrationUploadConfigured = Boolean(
  process.env.EXPO_PUBLIC_REGISTRATION_UPLOAD_PATH,
);
export async function uploadImage(
  asset: Media,
  registration = false,
): Promise<string> {
  const path = registration
    ? process.env.EXPO_PUBLIC_REGISTRATION_UPLOAD_PATH
    : process.env.EXPO_PUBLIC_UPLOAD_PATH;
  if (!path)
    throw new Error(
      "Photo uploads are not configured on this server yet. You can publish a text-only post.",
    );
  // Native conversion handles iPhone HEIC assets before the HTTP upload and
  // keeps full-resolution camera images from exhausting the upload size limit.
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 2048 || asset.height > 2048) {
    context.resize(
      asset.width >= asset.height ? { width: 2048 } : { height: 2048 },
    );
  }
  let file: { uri: string };
  try {
    const image = await context.renderAsync();
    try {
      file = await image.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
  const form = new FormData();
  // Expo SDK 57 fetch accepts Blob/File bytes, not RN's legacy { uri } part.
  const upload = new File(file.uri);
  form.append("file", upload);
  const response = await api<{ url: string }>(path, {
    method: "POST",
    body: form,
    auth: !registration,
  });
  return imageUrl.parse(response.url);
}
