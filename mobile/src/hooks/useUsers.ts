import { useInfiniteQuery } from "@tanstack/react-query";
import { recipesApi } from "../api/recipes";

export function useUsers(id: string, kind: "followers" | "following") {
  return useInfiniteQuery({
    queryKey: ["social", id, kind],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      recipesApi.users(id, kind, pageParam, signal),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
  });
}
