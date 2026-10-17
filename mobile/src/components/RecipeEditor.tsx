import { t } from "../store/language";
import { Text, View } from "react-native";
import { Button, Field, useUI } from "./ui";
import { recipeSchema, type RecipeDetails } from "../lib/recipe";
export interface RecipeDraft {
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  ingredients: { name: string; quantity: string; unit: string }[];
  steps: string;
}
export function recipeDraft(recipe?: RecipeDetails | null): RecipeDraft {
  return {
    servings: String(recipe?.servings ?? 2),
    prepMinutes: String(recipe?.prepMinutes ?? 0),
    cookMinutes: String(recipe?.cookMinutes ?? 0),
    ingredients: recipe?.ingredients.map((i) => ({
      ...i,
      quantity: i.quantity === null ? "" : String(i.quantity),
    })) ?? [{ name: "", quantity: "", unit: "" }],
    steps: recipe?.steps.join("\n") ?? "",
  };
}
export function parseRecipeDraft(draft: RecipeDraft) {
  return recipeSchema.parse({
    servings: Number(draft.servings),
    prepMinutes: Number(draft.prepMinutes),
    cookMinutes: Number(draft.cookMinutes),
    ingredients: draft.ingredients.map((i) => ({
      ...i,
      quantity: i.quantity.trim() ? Number(i.quantity) : null,
    })),
    steps: draft.steps
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  });
}
export function RecipeEditor({
  value,
  onChange,
  disabled,
}: {
  value: RecipeDraft | null;
  onChange: (draft: RecipeDraft | null) => void;
  disabled?: boolean;
}) {
  const { styles } = useUI();
  if (!value)
    return (
      <Button
        title={t("+ Add recipe details")}
        secondary
        disabled={disabled}
        onPress={() => onChange(recipeDraft())}
      />
    );
  const field = (
    key: "servings" | "prepMinutes" | "cookMinutes",
    label: string,
  ) => (
    <View key={key} style={{ flex: 1 }}>
      <Field
        label={label}
        value={value[key]}
        keyboardType="number-pad"
        maxLength={4}
        editable={!disabled}
        onChangeText={(text) => onChange({ ...value, [key]: text })}
      />
    </View>
  );
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{t("Recipe details")}</Text>
      <View style={styles.row}>
        {field("servings", "Servings")}
        {field("prepMinutes", "Prep (min)")}
        {field("cookMinutes", "Cook (min)")}
      </View>
      <Text style={styles.heading}>{t("Ingredients")}</Text>
      {value.ingredients.map((ingredient, index) => (
        <View key={index} style={{ gap: 6 }}>
          <Field
            label={t(`Ingredient ${index + 1}`)}
            placeholder={t("e.g. Rice / ဆန်")}
            value={ingredient.name}
            maxLength={200}
            editable={!disabled}
            onChangeText={(name) =>
              onChange({
                ...value,
                ingredients: value.ingredients.map((i, n) =>
                  n === index ? { ...i, name } : i,
                ),
              })
            }
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field
                label={t("Amount")}
                placeholder={t("Optional")}
                keyboardType="decimal-pad"
                value={ingredient.quantity}
                editable={!disabled}
                maxLength={12}
                onChangeText={(quantity) =>
                  onChange({
                    ...value,
                    ingredients: value.ingredients.map((i, n) =>
                      n === index ? { ...i, quantity } : i,
                    ),
                  })
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label={t("Unit")}
                placeholder={t("g, tbsp…")}
                value={ingredient.unit}
                editable={!disabled}
                maxLength={50}
                onChangeText={(unit) =>
                  onChange({
                    ...value,
                    ingredients: value.ingredients.map((i, n) =>
                      n === index ? { ...i, unit } : i,
                    ),
                  })
                }
              />
            </View>
          </View>
          {value.ingredients.length > 1 && (
            <Button
              title={t("Remove ingredient")}
              secondary
              disabled={disabled}
              onPress={() =>
                onChange({
                  ...value,
                  ingredients: value.ingredients.filter((_, n) => n !== index),
                })
              }
            />
          )}
        </View>
      ))}
      <Button
        title={t("+ Ingredient")}
        secondary
        disabled={disabled || value.ingredients.length >= 60}
        onPress={() =>
          onChange({
            ...value,
            ingredients: [
              ...value.ingredients,
              { name: "", quantity: "", unit: "" },
            ],
          })
        }
      />
      <Field
        label={t("Steps — one step per line")}
        value={value.steps}
        multiline
        maxLength={60000}
        editable={!disabled}
        onChangeText={(steps) => onChange({ ...value, steps })}
      />
      <Button
        title={t("Remove recipe details")}
        secondary
        disabled={disabled}
        onPress={() => onChange(null)}
      />
    </View>
  );
}
