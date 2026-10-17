import { z } from '../../shared/zod.js';
export const ingredientDto = z.strictObject({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(100000).nullable(),
  unit: z.string().trim().max(50),
});
export const recipeDto = z.strictObject({
  servings: z.number().int().min(1).max(100),
  prepMinutes: z.number().int().min(0).max(1440),
  cookMinutes: z.number().int().min(0).max(1440),
  ingredients: z.array(ingredientDto).min(1).max(60),
  steps: z.array(z.string().trim().min(1).max(2000)).min(1).max(30),
});
export type RecipeDetails = z.infer<typeof recipeDto>;
