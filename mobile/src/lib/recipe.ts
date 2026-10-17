import { z } from "zod";
export const recipeSchema = z.object({
  servings: z.number().int().min(1).max(100),
  prepMinutes: z.number().int().min(0).max(1440),
  cookMinutes: z.number().int().min(0).max(1440),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        quantity: z.number().positive().max(100000).nullable(),
        unit: z.string().trim().max(50),
      }),
    )
    .min(1)
    .max(60),
  steps: z.array(z.string().trim().min(1).max(2000)).min(1).max(30),
});
export type RecipeDetails = z.infer<typeof recipeSchema>;
export function scaledQuantity(
  quantity: number | null,
  originalServings: number,
  servings: number,
) {
  if (quantity === null) return "";
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(
    (quantity * servings) / originalServings,
  );
}
export function recipeShoppingItems(recipe: RecipeDetails, servings: number) {
  return recipe.ingredients.map((item) => ({
    name: item.name,
    quantity: [
      scaledQuantity(item.quantity, recipe.servings, servings),
      item.unit,
    ]
      .filter(Boolean)
      .join(" "),
  }));
}
