import Constants from "expo-constants";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { libraryApi } from "../api/library";
const enabledKey = "push-enabled";
const tokenKey = "push-token";
export const pushSupported =
  Platform.OS !== "web" && Constants.appOwnership !== "expo" && Device.isDevice;
export async function pushEnabled() {
  return (await SecureStore.getItemAsync(enabledKey)) === "true";
}
export async function connectPush(requestPermission = false) {
  if (!pushSupported)
    throw new Error(
      "Push notifications need an installed Android app. They are unavailable in Expo Go.",
    );
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId)
    throw new Error(
      "Push notifications are not configured for this build yet.",
    );
  const Notifications = await import("expo-notifications");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("community", {
      name: "Community",
      importance: Notifications.AndroidImportance.HIGH,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (
    permission.status !== "granted" &&
    requestPermission &&
    permission.canAskAgain
  )
    permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error(
      "Allow notifications in your phone settings to receive updates.",
    );
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await libraryApi.registerPush(token);
  await SecureStore.setItemAsync(tokenKey, token);
  await SecureStore.setItemAsync(enabledKey, "true");
}
export async function disconnectPush() {
  const token = await SecureStore.getItemAsync(tokenKey);
  if (token) await libraryApi.unregisterPush(token);
  await SecureStore.setItemAsync(enabledKey, "false");
  await SecureStore.deleteItemAsync(tokenKey);
}
