import { describe, expect, it } from "vitest";
import { relativeTime } from "../src/lib/time";
const now = Date.parse("2026-10-17T12:00:00Z");
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();
describe("relative timestamps", () => {
  it.each([
    [0, "Just now"],
    [59, "Just now"],
    [60, "1 min ago"],
    [119, "1 min ago"],
    [120, "2 min ago"],
    [3599, "59 min ago"],
    [3600, "1 hour ago"],
    [7200, "2 hours ago"],
    [86400, "1 day ago"],
    [604800, "1 week ago"],
    [2592000, "1 month ago"],
    [31536000, "1 year ago"],
  ])("formats elapsed seconds %i", (seconds, expected) => {
    expect(relativeTime(ago(Number(seconds)), now)).toBe(expected);
  });
  it("handles future clock skew and invalid dates without NaN", () => {
    expect(relativeTime(ago(-90), now)).toBe("Just now");
    expect(relativeTime("invalid", now)).toBe("Recently");
  });
  it("updates as time passes without fetching the post again", () => {
    const created = ago(30);
    expect(relativeTime(created, now)).toBe("Just now");
    expect(relativeTime(created, now + 60000)).toBe("1 min ago");
  });
});
