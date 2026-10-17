import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  InfiniteQueryObserver,
  infiniteQueryOptions,
  type InfiniteData,
} from "@tanstack/react-query";
import type { Page, Post } from "../src/api/types";
import { refreshFeed } from "../src/lib/feed";
const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.clear()));
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const get = vi.fn(
    async (page: number, _signal: AbortSignal): Promise<Page<Post>> => ({
      data: [],
      pagination: { page, limit: 20, total: 60, totalPages: 3 },
    }),
  );
  const options = infiniteQueryOptions({
    queryKey: ["feed"],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => get(pageParam, signal),
    getNextPageParam: (last: Page<Post>) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
  });
  return { client, get, options };
}
describe("feed reload", () => {
  it("reloads only page one after browsing multiple pages", async () => {
    const { client, get, options } = setup();
    await client.fetchInfiniteQuery(options);
    const observer = new InfiniteQueryObserver(client, options);
    await observer.fetchNextPage();
    await observer.fetchNextPage();
    await observer.fetchNextPage(); // Last page: no extra network request.
    expect(get.mock.calls.map(([page]) => page)).toEqual([1, 2, 3]);
    get.mockClear();
    await refreshFeed(client);
    expect(get.mock.calls.map(([page]) => page)).toEqual([1]);
    expect(
      client.getQueryData<InfiniteData<Page<Post>>>(["feed"])?.pageParams,
    ).toEqual([1]);
  });
  it("keeps the first cached page available when reload fails, allowing retry", async () => {
    const { client, get, options } = setup();
    await client.fetchInfiniteQuery(options);
    await new InfiniteQueryObserver(client, options).fetchNextPage();
    get.mockRejectedValueOnce(new Error("offline"));
    await expect(refreshFeed(client)).rejects.toThrow("offline");
    expect(
      client.getQueryData<InfiniteData<Page<Post>>>(["feed"])?.pages,
    ).toHaveLength(1);
    await refreshFeed(client);
    expect(client.getQueryState(["feed"])?.status).toBe("success");
  });
  it("cancels an in-flight fetch before starting the fresh first page", async () => {
    const { client, get, options } = setup();
    await client.fetchInfiniteQuery(options);
    let aborted = false;
    get.mockImplementationOnce(
      (_page, signal) =>
        new Promise<Page<Post>>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("cancelled"));
          });
        }),
    );
    const observer = new InfiniteQueryObserver(client, options);
    const pending = observer.fetchNextPage().catch(() => undefined);
    await refreshFeed(client);
    await pending;
    expect(aborted).toBe(true);
    expect(get.mock.calls.map(([page]) => page)).toEqual([1, 2, 1]);
    expect(client.getQueryState(["feed"])?.status).toBe("success");
  });
});
