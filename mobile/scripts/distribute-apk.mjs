import { createWriteStream } from "node:fs";
import { mkdir, open, readFile, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import process from "node:process";

export const TELEGRAM_FILE_LIMIT = 50_000_000;

export function selectBuild(result, expectedCommit) {
  const builds = Array.isArray(result) ? result : [result];
  const android = builds.filter((build) => build?.platform === "ANDROID");
  if (android.length !== 1 || android[0].status !== "FINISHED") {
    throw new Error("Expected one successfully finished Android EAS build.");
  }
  const build = android[0];
  if (expectedCommit && build.gitCommitHash !== expectedCommit) {
    throw new Error(
      "EAS build commit does not match the checked GitHub commit.",
    );
  }
  const url = new URL(build.artifacts?.buildUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !url.pathname.toLowerCase().endsWith(".apk")
  ) {
    throw new Error(
      "EAS must return an HTTPS APK artifact from the preview profile.",
    );
  }
  return { url: url.href };
}

export async function downloadApk(build, destination, fetchImpl = fetch) {
  await mkdir(dirname(destination), { recursive: true });
  try {
    const response = await fetchImpl(build.url, {
      signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok || !response.body) {
      throw new Error(`APK download failed (HTTP ${response.status}).`);
    }
    if (response.url && new URL(response.url).protocol !== "https:") {
      throw new Error("APK download redirected away from HTTPS.");
    }
    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(destination, { mode: 0o600 }),
    );
    const file = await open(destination, "r");
    try {
      const signature = Buffer.alloc(4);
      await file.read(signature, 0, 4, 0);
      if (!signature.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
        throw new Error("The downloaded artifact is not an APK/ZIP file.");
      }
    } finally {
      await file.close();
    }
  } catch {
    await rm(destination, { force: true });
    throw new Error(
      "Could not download a valid APK from the completed EAS build.",
    );
  }
}

export async function sendApk(
  { build, path, token, chatId, commit = "", runUrl = "" },
  fetchImpl = fetch,
) {
  if (!token || !chatId) {
    throw new Error(
      "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in GitHub Actions secrets.",
    );
  }
  const size = (await stat(path)).size;
  const caption = `SocialRecipe Hub APK\nCommit: ${commit.slice(0, 12)}${runUrl ? `\nCI: ${runUrl}` : ""}`;
  async function post(method, body) {
    try {
      const response = await fetchImpl(
        `https://api.telegram.org/bot${token}/${method}`,
        { method: "POST", body, signal: AbortSignal.timeout(300_000) },
      );
      const result = await response.json();
      return {
        ok: response.ok && result.ok === true,
        code: result.error_code ?? response.status,
      };
    } catch {
      // Fetch errors may contain the request URL, including the bot token.
      throw new Error(
        "Telegram request failed. Check connectivity and bot/chat configuration.",
      );
    }
  }
  if (size <= TELEGRAM_FILE_LIMIT) {
    const form = new FormData();
    form.set("chat_id", chatId);
    form.set("caption", caption);
    form.set(
      "document",
      new Blob([await readFile(path)], {
        type: "application/vnd.android.package-archive",
      }),
      "SocialRecipe-Hub.apk",
    );
    const result = await post("sendDocument", form);
    if (result.ok) return "file";
    if (result.code !== 413) {
      throw new Error(
        `Telegram upload failed (${result.code}). Check the bot token, chat ID and chat permissions.`,
      );
    }
  }
  const result = await post(
    "sendMessage",
    new URLSearchParams({
      chat_id: chatId,
      text: `${caption}\n\nAPK exceeds Telegram's bot upload limit. Download the APK:\n${build.url}\n\nThe APK is also saved in this GitHub Actions run's artifacts.`,
      disable_web_page_preview: "true",
    }),
  );
  if (!result.ok) {
    throw new Error(
      `Telegram link delivery failed (${result.code}). Check the bot token, chat ID and chat permissions.`,
    );
  }
  return "link";
}

async function main() {
  const [command, resultFile, apkPath] = process.argv.slice(2);
  if (!["download", "send"].includes(command) || !resultFile || !apkPath) {
    throw new Error(
      "Usage: node scripts/distribute-apk.mjs download|send EAS_RESULT_JSON APK_PATH",
    );
  }
  const build = selectBuild(
    JSON.parse(await readFile(resultFile, "utf8")),
    process.env.GITHUB_SHA,
  );
  if (command === "download") {
    await downloadApk(build, apkPath);
    console.log("Downloaded the completed Android APK.");
  } else {
    const delivery = await sendApk({
      build,
      path: apkPath,
      token: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
      commit: process.env.GITHUB_SHA,
      runUrl:
        process.env.GITHUB_SERVER_URL &&
        process.env.GITHUB_REPOSITORY &&
        process.env.GITHUB_RUN_ID
          ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
          : "",
    });
    console.log(`Telegram delivery completed (${delivery}).`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
