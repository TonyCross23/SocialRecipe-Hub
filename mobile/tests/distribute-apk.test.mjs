import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadApk,
  selectBuild,
  sendApk,
  TELEGRAM_FILE_LIMIT,
} from "../scripts/distribute-apk.mjs";

const directories = [];
async function fixture(size) {
  const directory = await mkdtemp(join(tmpdir(), "socialrecipe-apk-"));
  directories.push(directory);
  const path = join(directory, "app.apk");
  await writeFile(path, Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]));
  if (size) {
    const file = await open(path, "r+");
    await file.truncate(size);
    await file.close();
  }
  return path;
}
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
const commit = "a".repeat(40);
const build = { url: "https://expo.dev/artifacts/eas/test.apk" };
const result = [
  {
    platform: "ANDROID",
    status: "FINISHED",
    gitCommitHash: commit,
    artifacts: { buildUrl: build.url },
  },
];
const settings = {
  build,
  token: "test-only-bot-token",
  chatId: "1234",
  commit,
  runUrl: "https://github.com/example/app/actions/runs/1",
};

describe("APK delivery", () => {
  it("selects only the finished APK for the checked commit", () => {
    expect(selectBuild(result, commit)).toEqual(build);
    expect(() => selectBuild(result, "b".repeat(40))).toThrow("commit");
    expect(() =>
      selectBuild([{ ...result[0], status: "ERRORED" }], commit),
    ).toThrow("finished");
    for (const url of [
      "http://example.com/app.apk",
      "https://example.com/app.aab",
      "https://user:password@example.com/app.apk",
    ]) {
      expect(() =>
        selectBuild([{ ...result[0], artifacts: { buildUrl: url } }], commit),
      ).toThrow("HTTPS APK");
    }
  });

  it("downloads the APK and removes HTML/error downloads", async () => {
    const path = await fixture();
    const apk = Buffer.from([0x50, 0x4b, 0x03, 0x04, 4, 5, 6]);
    await downloadApk(
      build,
      path,
      vi.fn(async () => new Response(apk)),
    );
    expect(await readFile(path)).toEqual(apk);
    await expect(
      downloadApk(
        build,
        path,
        vi.fn(async () => new Response("<html>not an APK</html>")),
      ),
    ).rejects.toThrow("valid APK");
    await expect(readFile(path)).rejects.toThrow();
  });

  it("uploads the APK document with a commit and run link", async () => {
    const path = await fixture();
    const fetcher = vi.fn(async () => Response.json({ ok: true }));
    expect(await sendApk({ ...settings, path }, fetcher)).toBe("file");
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toMatch(/\/sendDocument$/);
    expect(options.body.get("chat_id")).toBe(settings.chatId);
    expect(options.body.get("document").name).toBe("SocialRecipe-Hub.apk");
    expect(options.body.get("caption")).toContain(commit.slice(0, 12));
  });

  it("sends the exact APK download link when the file exceeds the bot limit", async () => {
    const path = await fixture(TELEGRAM_FILE_LIMIT + 1);
    const fetcher = vi.fn(async () => Response.json({ ok: true }));
    expect(await sendApk({ ...settings, path }, fetcher)).toBe("link");
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toMatch(/\/sendMessage$/);
    expect(options.body.get("text")).toContain(build.url);
    expect(options.body.get("text")).toContain(settings.runUrl);
  });

  it("handles a Telegram size rejection but reports authentication/delivery failures", async () => {
    const path = await fixture();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ ok: false, error_code: 413 }, { status: 413 }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true }));
    expect(await sendApk({ ...settings, path }, fetcher)).toBe("link");
    expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(
      sendApk(
        { ...settings, path },
        vi.fn(async () =>
          Response.json({ ok: false, error_code: 403 }, { status: 403 }),
        ),
      ),
    ).rejects.toThrow("403");
    const failure = sendApk(
      { ...settings, path },
      vi.fn(async () => {
        throw new Error(`request failed: bot${settings.token}`);
      }),
    );
    await expect(failure).rejects.toThrow("Telegram request failed");
    await expect(failure).rejects.not.toThrow(settings.token);
  });
});
