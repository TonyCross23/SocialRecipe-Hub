import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) =>
        !(error instanceof ApiError && error.status < 500) && count < 2,
    },
    // Do not automatically replay writes (posts, comments, reports).
    mutations: { retry: false },
  },
});
