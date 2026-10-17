import { beforeEach, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));
vi.mock("expo-secure-store", () => storage);
import { useAppearance } from "../src/store/appearance";
describe("saved appearance preference", () => {
  beforeEach(() => {
    useAppearance.setState({ mode: "system" });
    storage.getItemAsync.mockReset();
    storage.setItemAsync.mockReset();
  });
  it("persists an explicit dark-mode choice and restores it after restart", async () => {
    storage.setItemAsync.mockResolvedValue(undefined);
    await useAppearance.getState().setMode("dark");
    expect(storage.setItemAsync).toHaveBeenCalledWith(
      "socialrecipe.appearance",
      "dark",
    );
    useAppearance.setState({ mode: "system" });
    storage.getItemAsync.mockResolvedValue("dark");
    await useAppearance.getState().hydrate();
    expect(useAppearance.getState().mode).toBe("dark");
  });
  it("uses the device preference if saved settings are invalid or unreadable", async () => {
    storage.getItemAsync.mockResolvedValue("invalid");
    await useAppearance.getState().hydrate();
    expect(useAppearance.getState().mode).toBe("system");
    storage.getItemAsync.mockRejectedValue(new Error("Unavailable"));
    await useAppearance.getState().hydrate();
    expect(useAppearance.getState().mode).toBe("system");
  });
  it("does not claim a preference was saved if secure storage fails", async () => {
    storage.setItemAsync.mockRejectedValue(new Error("Storage unavailable"));
    await expect(useAppearance.getState().setMode("dark")).rejects.toThrow(
      "Storage unavailable",
    );
    expect(useAppearance.getState().mode).toBe("system");
  });
});
