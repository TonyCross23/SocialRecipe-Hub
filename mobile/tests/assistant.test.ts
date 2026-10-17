import { describe, expect, it, vi } from "vitest";
vi.mock("../src/api/client", () => ({ api: vi.fn() }));
import { chatContext, type ChatMessage } from "../src/api/assistant";
describe("chat context", () => {
  it("keeps complete turns and the new user question within server limits", () => {
    const history: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: "x".repeat(2000),
    }));
    const result = chatContext(history, "What can replace eggs?");
    expect(result.length).toBeLessThanOrEqual(13);
    expect(
      result.reduce((sum, item) => sum + item.content.length, 0),
    ).toBeLessThanOrEqual(18000);
    expect(result[0].role).toBe("user");
    expect(result.at(-1)).toEqual({
      role: "user",
      content: "What can replace eggs?",
    });
    result.forEach((item, i) =>
      expect(item.role).toBe(i % 2 ? "assistant" : "user"),
    );
  });
});
