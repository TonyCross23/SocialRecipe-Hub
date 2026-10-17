import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));
import * as SecureStore from "expo-secure-store";
import { useLanguage, t } from "../src/store/language";
import { notificationMessage, translate } from "../src/i18n/translate";
beforeEach(() => {
  vi.clearAllMocks();
  useLanguage.setState({ language: "my" });
});
describe("app language", () => {
  it("persists selection and restores it without remounting navigation", async () => {
    await useLanguage.getState().setLanguage("en");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "socialrecipe.language",
      "en",
    );
    expect(t("Settings")).toBe("Settings");
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue("my");
    await useLanguage.getState().hydrate();
    expect(t("Settings")).toBe("ဆက်တင်များ");
  });
  it("translates relative times and labels while preserving user values", () => {
    expect(translate("2 min ago", "my")).toBe("2 မိနစ်အကြာ");
    expect(translate("Ingredient 3", "my")).toBe("ပါဝင်ပစ္စည်း 3");
    expect(translate("Alice's profile", "my")).toContain("Alice");
    expect(translate("My own custom recipe title", "my")).toBe(
      "My own custom recipe title",
    );
    expect(translate("2 min ago", "en")).toBe("2 min ago");
  });
  it("localizes notification actions without translating actor names or arbitrary content", () => {
    const item = {
      type: "FOLLOW",
      message: "Alice started following you.",
      data: { actor: { name: "Alice" } },
    };
    expect(notificationMessage(item, "my")).toBe(
      "Alice က သင့်ကို follow လုပ်ထားပါတယ်။",
    );
    expect(notificationMessage(item, "en")).toBe(item.message);
  });
});
