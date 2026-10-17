import { recipeSchema } from "./recipe";
import { z } from "zod";

export const imageUrl = z.url({ protocol: /^https$/ }).max(2048);
export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(100),
  password: z.string().min(12, "Use at least 12 characters").max(128),
  dob: z.iso
    .date()
    .refine(
      (value) =>
        Number(value.slice(0, 4)) >= 1900 &&
        new Date(`${value}T00:00:00Z`).getTime() <= Date.now(),
      "Choose a real date between 1900 and today",
    ),
  image: imageUrl.nullable().optional(),
});
// Confirmation is local form state; registration never uploads a profile photo.
export const registrationFormSchema = registerSchema
  .omit({ image: true })
  .extend({ confirmPassword: z.string().min(1, "Confirm your password") })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .transform(({ confirmPassword: _confirmation, ...payload }) => payload);
const postFields = z.object({
  recipe: recipeSchema.nullable().optional(),
  title: z
    .string()
    .trim()
    .min(3, "Add a title with at least 3 characters")
    .max(200),
  content: z.string().trim().max(20_000),
  images: z.array(imageUrl).max(10),
  visibility: z.enum(["PUBLIC", "FOLLOWERS", "PRIVATE"]),
});
export const postSchema = postFields.refine(
  (value) => value.content.length > 0 || value.images.length > 0,
  { message: "Add text or at least one photo", path: ["content"] },
);
export const postDraftSchema = postFields
  .omit({ images: true })
  .extend({ photoCount: z.number().int().min(0).max(10) })
  .refine((value) => value.content.length > 0 || value.photoCount > 0, {
    message: "Add text or at least one photo",
    path: ["content"],
  });
export const reportSchema = z
  .string()
  .trim()
  .min(10, "Please give at least 10 characters of detail")
  .max(2000);
export function postTitle(title: string, content: string) {
  if (title.trim()) return title.trim();
  const firstLine =
    content.trim().split(/\r?\n/)[0]?.trim().slice(0, 120) ?? "";
  return firstLine.length >= 3 ? firstLine : "Kitchen update";
}
export function dateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function errorMessage(error: unknown) {
  if (error instanceof z.ZodError)
    return error.issues
      .map((issue) => `${issue.path.join(".") || "Input"}: ${issue.message}`)
      .join("\n");
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
