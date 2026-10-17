import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { communityApi } from "../api/recipes";
import { useSession } from "../store/session";
export function usePeople(search = "", suggested = false) {
  return useInfiniteQuery({
    queryKey: ["people", search, suggested],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      communityApi.people(pageParam, search, suggested, signal),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
  });
}
export function useProfilePosts(id: string) {
  return useInfiniteQuery({
    queryKey: ["profilePosts", id],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      communityApi.posts(id, pageParam, signal),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
  });
}
export function useNotificationSummary() {
  const user = useSession((s) => s.user);
  return useQuery({
    queryKey: ["notificationSummary", user?.id],
    queryFn: ({ signal }) => communityApi.unread(signal),
    enabled: !!user,
    refetchInterval: 15000,
  });
}
