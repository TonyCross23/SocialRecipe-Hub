import { api } from "./client";
import type { Page, Post, SocialUser } from "./types";
export type FilterKind = "BLOCK" | "MUTE";
export interface ShoppingDraft {
  title: string;
  items: { name: string; quantity: string }[];
}
export interface ShoppingList extends ShoppingDraft {
  id: string;
  items: { id: string; name: string; quantity: string; checked: boolean }[];
}
export const libraryApi = {
  saved: (page: number, signal?: AbortSignal) =>
    api<Page<Post>>(`/library/saved?page=${page}&limit=20`, { signal }),
  save: (id: string, saved: boolean) =>
    api<{ saved: boolean }>(`/library/saved/${id}`, {
      method: saved ? "PUT" : "DELETE",
    }),
  filters: (kind: FilterKind, page: number, signal?: AbortSignal) =>
    api<Page<SocialUser>>(
      `/library/filters?kind=${kind}&page=${page}&limit=20`,
      { signal },
    ),
  filterState: (id: string, signal?: AbortSignal) =>
    api<{ blocked: boolean; muted: boolean }>(`/library/filters/${id}`, {
      signal,
    }),
  filter: (id: string, kind: FilterKind, enabled: boolean) =>
    api(`/library/filters/${id}/${kind}`, {
      method: enabled ? "PUT" : "DELETE",
    }),
  lists: (page: number, signal?: AbortSignal) =>
    api<Page<{ id: string; title: string; _count: { items: number } }>>(
      `/library/shopping-lists?page=${page}&limit=20`,
      { signal },
    ),
  list: (id: string, signal?: AbortSignal) =>
    api<{ list: ShoppingList }>(`/library/shopping-lists/${id}`, { signal }),
  createList: (draft: ShoppingDraft) =>
    api<{ list: ShoppingList }>("/library/shopping-lists", {
      method: "POST",
      body: draft,
    }),
  deleteList: (id: string) =>
    api<void>(`/library/shopping-lists/${id}`, { method: "DELETE" }),
  checkItem: (id: string, itemId: string, checked: boolean) =>
    api(`/library/shopping-lists/${id}/items/${itemId}`, {
      method: "PATCH",
      body: { checked },
    }),
  extractList: (source: string) =>
    api<{ draft: ShoppingDraft }>("/assistant/shopping-list", {
      method: "POST",
      body: { source },
    }),
  registerPush: (token: string) =>
    api<{ id: string }>("/library/push-devices", {
      method: "POST",
      body: { token },
    }),
  unregisterPush: (token: string) =>
    api<void>("/library/push-devices", { method: "DELETE", body: { token } }),
};
