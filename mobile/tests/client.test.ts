import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  accessToken: "old-access" as string | null,
  refreshToken: "refresh",
  revision: 1,
  rotate: vi.fn(),
  clear: vi.fn(),
}));
vi.mock("../src/store/session", () => ({
  useSession: { getState: () => session },
}));
import { api } from "../src/api/client";

describe("authenticated requests", () => {
  beforeEach(() => {
    session.accessToken = "old-access";
    session.revision = 1;
    session.rotate.mockImplementation(async (tokens) => {
      session.accessToken = tokens.accessToken;
    });
    session.clear.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());
  it("shares a single refresh between concurrent expired-token requests", async () => {
    let refreshes = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options: RequestInit) => {
        if (url.endsWith("/auth/refresh")) {
          refreshes++;
          await new Promise((resolve) => setTimeout(resolve, 10));
          return Response.json({
            accessToken: "new-access",
            refreshToken: "rotated",
          });
        }
        return (options.headers as Record<string, string>).Authorization ===
          "Bearer new-access"
          ? Response.json({ ok: true })
          : Response.json({ error: { message: "Expired" } }, { status: 401 });
      }),
    );
    const result = await Promise.all([api("/posts/feed"), api("/auth/me")]);
    expect(refreshes).toBe(1);
    expect(result).toEqual([{ ok: true }, { ok: true }]);
  });
  it("does not replay failed content writes", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ error: { message: "Unavailable" } }, { status: 503 }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      api("/posts", { method: "POST", body: { title: "Soup" } }),
    ).rejects.toThrow("Unavailable");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("clears rejected sessions but preserves sessions on temporary refresh failures", async () => {
    session.accessToken = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: { message: "Expired" } }, { status: 401 }),
      ),
    );
    await expect(api("/auth/me")).rejects.toThrow("Expired");
    expect(session.clear).toHaveBeenCalledOnce();
    session.clear.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Network unavailable");
      }),
    );
    await expect(api("/auth/me")).rejects.toThrow("Network unavailable");
    expect(session.clear).not.toHaveBeenCalled();
  });
  it("rejects external endpoint URLs to avoid leaking bearer tokens", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(api("//external.example/upload")).rejects.toThrow(
      "backend-relative",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
