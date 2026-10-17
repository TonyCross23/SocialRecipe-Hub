import { z } from "zod";
import { api } from "./client";
export type ChatMessage = { role: "user" | "assistant"; content: string };
export const assistantStatus = (signal?: AbortSignal) =>
  api<{ configured: boolean; replyLanguage?: "english" | "auto" | "burmese" }>(
    "/assistant/status",
    { signal },
  );
// Keep complete user/assistant pairs, bounded for latency and the server DTO.
export function chatContext(
  history: ChatMessage[],
  question: string,
): ChatMessage[] {
  const turns = history.slice(-12);
  while (
    turns.length &&
    turns.reduce((sum, item) => sum + item.content.length, question.length) >
      18000
  )
    turns.splice(0, 2);
  return [...turns, { role: "user", content: question }];
}
export async function askAssistant(
  messages: ChatMessage[],
  language?: "en" | "my",
) {
  const result = await api<unknown>("/assistant/chat", {
    method: "POST",
    body: { messages, ...(language ? { language } : {}) },
  });
  return z.object({ message: z.string().min(1).max(8000) }).parse(result)
    .message;
}
