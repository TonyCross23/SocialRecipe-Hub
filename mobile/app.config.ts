import type { ConfigContext, ExpoConfig } from "expo/config";
import { withAndroidManifest } from "expo/config-plugins";

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const cloudBuild = process.env.EAS_BUILD === "true";
  const production = process.env.EAS_BUILD_PROFILE === "production";

  if (cloudBuild) {
    if (!apiUrl) {
      throw new Error(
        "Set EXPO_PUBLIC_API_URL in the matching EAS environment before building. The emulator default cannot be used in an installable app.",
      );
    }
    const parsed = new URL(apiUrl);
    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      ["localhost", "127.0.0.1", "10.0.2.2", "[::1]"].includes(
        parsed.hostname,
      ) ||
      !parsed.pathname.replace(/\/$/, "").endsWith("/api/v1") ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(
        "Use a phone-accessible API URL ending in /api/v1, without credentials, query, or fragment.",
      );
    }
    if (production && parsed.protocol !== "https:") {
      throw new Error("Production builds require an HTTPS API URL.");
    }
  }

  const result = {
    ...config,
    extra: {
      ...config.extra,
      ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID
        ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } }
        : {}),
    },
    android: {
      ...config.android,
      ...(process.env.GOOGLE_SERVICES_JSON
        ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
        : {}),
    },
    name: config.name ?? "SocialRecipe Hub",
    slug: config.slug ?? "socialrecipe-hub",
  };
  // Preview APKs can reach a developer's HTTP API on the same LAN.
  // Production builds always disable cleartext traffic.
  return withAndroidManifest(result, (androidConfig) => {
    const application = androidConfig.modResults.manifest.application?.[0];
    if (application) {
      application.$["android:usesCleartextTraffic"] =
        !production && apiUrl?.startsWith("http://") ? "true" : "false";
    }
    return androidConfig;
  });
};
