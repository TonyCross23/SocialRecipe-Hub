import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { Page, Post } from "../api/types";

/** Cancel an appended page before refreshing so old results cannot rejoin the feed. */
export async function refreshFeed(client: QueryClient) {
  const filter = { queryKey: ["feed"], exact: true } as const;
  await client.cancelQueries(filter);
  client.setQueryData<InfiniteData<Page<Post>, number>>(
    filter.queryKey,
    (data) =>
      data
        ? {
            pages: data.pages.slice(0, 1),
            pageParams: data.pageParams.slice(0, 1),
          }
        : data,
  );
  await client.refetchQueries(
    { ...filter, type: "all" },
    { throwOnError: true },
  );
}
