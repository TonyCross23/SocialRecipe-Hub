import { describe, expect, it } from "vitest";
import {
  recipeSchema,
  recipeShoppingItems,
  scaledQuantity,
} from "../src/lib/recipe";
const recipe = {
  servings: 2,
  prepMinutes: 5,
  cookMinutes: 20,
  ingredients: [
    { name: "ဆန်", quantity: 200, unit: "g" },
    { name: "Salt", quantity: null, unit: "to taste" },
  ],
  steps: ["Cook."],
};
describe("recipe servings", () => {
  it("scales quantities without changing the recipe or to-taste ingredients", () => {
    expect(recipeShoppingItems(recipe, 4)).toEqual([
      { name: "ဆန်", quantity: "400 g" },
      { name: "Salt", quantity: "to taste" },
    ]);
    expect(recipe.ingredients[0].quantity).toBe(200);
    expect(scaledQuantity(1, 3, 2)).toBe("0.67");
  });
  it("rejects unsafe servings, invalid ingredient amounts and empty steps", () => {
    expect(recipeSchema.safeParse({ ...recipe, servings: 0 }).success).toBe(
      false,
    );
    expect(recipeSchema.safeParse({ ...recipe, steps: [] }).success).toBe(
      false,
    );
    expect(
      recipeSchema.safeParse({
        ...recipe,
        ingredients: [{ name: "Rice", quantity: -20, unit: "g" }],
      }).success,
    ).toBe(false);
    expect(recipeSchema.safeParse(recipe).success).toBe(true);
  });
});
