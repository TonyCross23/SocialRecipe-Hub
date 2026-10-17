import { useSession } from "../store/session";
import type { Tokens } from "./types";

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:4000/api/v1"
).replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
type Options = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  auth?: boolean;
};
function endpoint(path: string) {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://"))
    throw new Error("Use a backend-relative API path");
  return `${API_URL}${path}`;
}
async function send<T>(
  path: string,
  options: Options,
  token?: string | null,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort);
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 30_000);
  const multipart = options.body instanceof FormData;
  try {
    const response = await fetch(endpoint(path), {
      method: options.method ?? "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(!multipart && options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body:
        options.body === undefined
          ? undefined
          : multipart
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    });
    if (response.status === 204) return undefined as T;
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const details = payload?.error?.issues
        ?.map(
          (issue: { path: string[]; message: string }) =>
            `${issue.path.join(".")}: ${issue.message}`,
        )
        .join("\n");
      throw new ApiError(
        response.status,
        details ||
          payload?.error?.message ||
          `Request failed (${response.status})`,
        payload?.error?.code,
      );
    }
    if (payload === null)
      throw new Error("The server returned an invalid response");
    return payload as T;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
let refreshing: Promise<void> | null = null;
export function refreshSession() {
  if (!refreshing) {
    const { refreshToken, revision } = useSession.getState();
    refreshing = (async () => {
      if (!refreshToken) throw new ApiError(401, "Please sign in again");
      try {
        const tokens = await send<Tokens>("/auth/refresh", {
          method: "POST",
          body: { refreshToken },
        });
        await useSession.getState().rotate(tokens, revision);
      } catch (error) {
        if (
          error instanceof ApiError &&
          [400, 401, 403].includes(error.status) &&
          useSession.getState().revision === revision
        )
          await useSession.getState().clear();
        throw error;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  if (options.auth === false) return send<T>(path, options);
  if (!useSession.getState().accessToken) await refreshSession();
  const token = useSession.getState().accessToken;
  const revision = useSession.getState().revision;
  try {
    return await send<T>(path, options, token);
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      options.signal?.aborted
    )
      throw error;
    if (useSession.getState().revision !== revision) throw error;
    // Another request may have already rotated while this request was in flight.
    if (useSession.getState().accessToken === token) await refreshSession();
    return send<T>(path, options, useSession.getState().accessToken);
  }
}
