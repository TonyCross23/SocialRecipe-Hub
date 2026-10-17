import { t } from "../store/language";
import { useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParams } from "../navigation/types";
import type { RecipeDetails as Details } from "../lib/recipe";
import { recipeShoppingItems } from "../lib/recipe";
import { Button, IconButton, useUI } from "./ui";
export function RecipeDetails({
  recipe,
  title,
}: {
  recipe: Details;
  title: string;
}) {
  const { styles } = useUI();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [servings, setServings] = useState(recipe.servings);
  const items = recipeShoppingItems(recipe, servings);
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{t("Recipe")}</Text>
      <Text style={styles.muted}>
        {t("Prep")} {recipe.prepMinutes} {t("min · Cook")} {recipe.cookMinutes}{" "}
        {t("min")}
      </Text>
      <View style={styles.row}>
        <Text style={[styles.body, { flex: 1 }]}>
          {t("Servings:")} {servings}
        </Text>
        <IconButton
          name="remove"
          label={t("Fewer servings")}
          disabled={servings <= 1}
          onPress={() => setServings((s) => s - 1)}
        />
        <IconButton
          name="add"
          label={t("More servings")}
          disabled={servings >= 100}
          onPress={() => setServings((s) => s + 1)}
        />
      </View>
      <Text style={styles.heading}>{t("Ingredients")}</Text>
      {items.map((item, i) => (
        <View key={i} style={[styles.row, { alignItems: "flex-start" }]}>
          <Text style={[styles.body, { flex: 1 }]}>{item.name}</Text>
          <Text style={[styles.body, { flexShrink: 1 }]}>
            {item.quantity || t("To taste")}
          </Text>
        </View>
      ))}
      <Button
        title={t("Add to shopping list")}
        secondary
        onPress={() => nav.push("ShoppingList", { draft: { title, items } })}
      />
      <Text style={styles.heading}>{t("Steps")}</Text>
      {recipe.steps.map((step, i) => (
        <View style={[styles.row, { alignItems: "flex-start" }]} key={i}>
          <Text style={styles.heading}>{i + 1}.</Text>
          <Text style={[styles.body, { flex: 1 }]}>{step}</Text>
        </View>
      ))}
      <Text style={styles.muted}>
        {t(
          "Ingredient amounts scale with servings. Cooking time and seasoning may need adjustment.",
        )}
      </Text>
    </View>
  );
}
