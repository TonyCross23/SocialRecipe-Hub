import { describe, expect, it } from "vitest";
import {
  postDraftSchema,
  postSchema,
  postTitle,
  registerSchema,
  registrationFormSchema,
} from "../src/lib/validation";

describe("backend-compatible form validation", () => {
  it("requires matching confirmation and sends only the registration fields", () => {
    const form = {
      name: "A Cook",
      email: "cook@example.com",
      password: "long-password-123",
      confirmPassword: "long-password-123",
      dob: "2000-02-29",
      image: "https://cdn.example.com/ignored.jpg",
    };
    expect(registrationFormSchema.parse(form)).toEqual({
      name: form.name,
      email: form.email,
      password: form.password,
      dob: form.dob,
    });
    for (const confirmPassword of ["", "different-password"])
      expect(
        registrationFormSchema.safeParse({ ...form, confirmPassword }).success,
      ).toBe(false);
  });
  it("lets status and photo updates omit a recipe title while meeting the API contract", () => {
    expect(postTitle("", "A simple lunch\nRecipe steps")).toBe(
      "A simple lunch",
    );
    expect(postTitle("", "")).toBe("Kitchen update");
    expect(postTitle("Rice soup", "A simple lunch")).toBe("Rice soup");
    expect(
      postSchema.safeParse({
        title: postTitle("", "Hi"),
        content: "Hi",
        images: [],
        visibility: "PUBLIC",
      }).success,
    ).toBe(true);
    expect(
      postSchema.safeParse({
        title: postTitle("", ""),
        content: "",
        images: ["https://cdn.example.com/photo.jpg"],
        visibility: "PUBLIC",
      }).success,
    ).toBe(true);
  });
  const textPost = {
    title: "Rice soup",
    content: "Simmer rice in stock.",
    images: [],
    visibility: "PUBLIC",
  };
  it("accepts text-only and image-only posts, rejecting empty content", () => {
    expect(postSchema.safeParse(textPost).success).toBe(true);
    expect(
      postSchema.safeParse({
        ...textPost,
        content: "",
        images: ["https://cdn.example.com/rice.jpg"],
      }).success,
    ).toBe(true);
    expect(postSchema.safeParse({ ...textPost, content: "  " }).success).toBe(
      false,
    );
  });
  it("rejects local image URIs and excess photos before calling the backend", () => {
    expect(
      postSchema.safeParse({ ...textPost, images: ["file:///photo.jpg"] })
        .success,
    ).toBe(false);
    expect(
      postSchema.safeParse({
        ...textPost,
        images: Array(11).fill("https://cdn.example.com/rice.jpg"),
      }).success,
    ).toBe(false);
  });
  it("explains an incomplete draft and accepts text-only or photo-only drafts", () => {
    const draft = {
      title: "",
      content: "My recipe",
      photoCount: 0,
      visibility: "PUBLIC",
    };
    const invalid = postDraftSchema.safeParse(draft);
    expect(invalid.success).toBe(false);
    if (!invalid.success)
      expect(
        invalid.error.issues.some(
          (issue) => issue.message === "Add a title with at least 3 characters",
        ),
      ).toBe(true);
    expect(
      postDraftSchema.safeParse({ ...draft, title: "Rice soup" }).success,
    ).toBe(true);
    expect(
      postDraftSchema.safeParse({
        ...draft,
        title: "Rice soup",
        content: "",
        photoCount: 1,
      }).success,
    ).toBe(true);
    expect(
      postDraftSchema.safeParse({ ...draft, title: "Rice soup", content: "" })
        .success,
    ).toBe(false);
  });
  it("enforces actual birth dates and backend password length", () => {
    const registration = {
      name: "A Cook",
      email: "cook@example.com",
      password: "long-password-123",
      dob: "2000-02-29",
    };
    expect(registerSchema.safeParse(registration).success).toBe(true);
    for (const dob of ["2001-02-29", "1899-01-01", "2999-01-01"])
      expect(registerSchema.safeParse({ ...registration, dob }).success).toBe(
        false,
      );
    expect(
      registerSchema.safeParse({ ...registration, password: "short" }).success,
    ).toBe(false);
  });
});
