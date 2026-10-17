import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  api: vi.fn(),
  release: vi.fn(),
  contextRelease: vi.fn(),
  resized: vi.fn(),
}));
vi.mock("../src/api/client", () => ({ api: mock.api }));
vi.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: {
    manipulate: () => ({
      resize: mock.resized,
      renderAsync: async () => ({
        saveAsync: async () => ({ uri: "file:///converted.jpg" }),
        release: mock.release,
      }),
      release: mock.contextRelease,
    }),
  },
}));
vi.mock("expo-file-system", () => ({
  File: class extends Blob {
    name = "converted.jpg";
    uri: string;
    constructor(uri: string) {
      super([new Uint8Array([255, 216, 255])], { type: "image/jpeg" });
      this.uri = uri;
    }
  },
}));
import { uploadImage } from "../src/api/media";
describe("Expo multipart photo uploads", () => {
  beforeEach(() => {
    vi.stubEnv("EXPO_PUBLIC_UPLOAD_PATH", "/media/images");
    vi.stubEnv(
      "EXPO_PUBLIC_REGISTRATION_UPLOAD_PATH",
      "/media/registration-images",
    );
    mock.api.mockResolvedValue({
      url: "https://res.cloudinary.com/example/image/upload/photo.jpg",
    });
  });
  it("appends byte-readable File data rather than the unsupported URI object", async () => {
    await uploadImage({
      uri: "file:///photo.heic",
      width: 4000,
      height: 3000,
      assetId: null,
      fileName: "photo.heic",
      type: "image",
    });
    const [path, options] = mock.api.mock.calls.at(-1)!;
    expect(path).toBe("/media/images");
    const file = options.body.get("file");
    expect(file).toBeInstanceOf(Blob);
    expect(file.type).toBe("image/jpeg");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(
      new Uint8Array([255, 216, 255]),
    );
    expect(mock.resized).toHaveBeenCalledWith({ width: 2048 });
    expect(mock.release).toHaveBeenCalled();
    expect(mock.contextRelease).toHaveBeenCalled();
  });
  it("uses the unauthenticated registration upload path for profile photos", async () => {
    await uploadImage(
      {
        uri: "file:///avatar.jpg",
        width: 100,
        height: 100,
        assetId: null,
        type: "image",
      },
      true,
    );
    expect(mock.api.mock.calls.at(-1)![0]).toBe("/media/registration-images");
    expect(mock.api.mock.calls.at(-1)![1].auth).toBe(false);
  });
});
