import { t } from "../store/language";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParams } from "../navigation/types";
import { libraryApi, type ShoppingDraft } from "../api/library";
import {
  Button,
  ErrorNotice,
  Field,
  IconButton,
  useUI,
} from "../components/ui";
export function ShoppingListScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParams, "ShoppingList">) {
  const { styles, colors } = useUI();
  const client = useQueryClient();
  const { id } = route.params;
  const [draft, setDraft] = useState<ShoppingDraft>(
    route.params.draft ?? {
      title: "Shopping list",
      items: [{ name: "", quantity: "" }],
    },
  );
  const query = useQuery({
    queryKey: ["shoppingList", id],
    queryFn: ({ signal }) => libraryApi.list(id!, signal),
    enabled: !!id,
  });
  const create = useMutation({
    mutationFn: () => {
      if (
        !draft.title.trim() ||
        !draft.items.length ||
        draft.items.some((i) => !i.name.trim())
      )
        throw new Error("Add a title and an ingredient name for each item.");
      return libraryApi.createList(draft);
    },
    onSuccess: async ({ list }) => {
      client.setQueryData(["shoppingList", list.id], { list });
      await client.invalidateQueries({ queryKey: ["shoppingLists"] });
      navigation.replace("ShoppingList", { id: list.id });
    },
  });
  const check = useMutation({
    mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) =>
      libraryApi.checkItem(id!, itemId, checked),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["shoppingList", id] }),
  });
  const remove = useMutation({
    mutationFn: () => libraryApi.deleteList(id!),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["shoppingLists"] });
      navigation.goBack();
    },
  });
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {id ? (
        <>
          {query.isError && (
            <ErrorNotice
              error={query.error}
              retry={() => {
                void query.refetch();
              }}
            />
          )}
          <Text style={styles.title}>
            {query.data?.list.title ?? "Loading…"}
          </Text>
          {query.data && (
            <Text style={styles.muted}>
              {query.data.list.items.filter((i) => i.checked).length} /{" "}
              {query.data.list.items.length} {t("bought")}
            </Text>
          )}
          {query.data?.list.items.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: item.checked,
                disabled: check.isPending,
              }}
              accessibilityLabel={t(`${item.name} ${item.quantity}`)}
              disabled={check.isPending}
              onPress={() =>
                check.mutate({ itemId: item.id, checked: !item.checked })
              }
              style={[styles.card, styles.row]}
            >
              <Ionicons
                name={item.checked ? "checkbox" : "square-outline"}
                color={item.checked ? colors.brand : colors.muted}
                size={24}
              />
              <Text
                style={[
                  styles.body,
                  {
                    flex: 1,
                    textDecorationLine: item.checked ? "line-through" : "none",
                    color: item.checked ? colors.muted : colors.ink,
                  },
                ]}
              >
                {item.name}
              </Text>
              <Text style={styles.muted}>{item.quantity}</Text>
            </Pressable>
          ))}
          {check.isError && <ErrorNotice error={check.error} />}
          {remove.isError && <ErrorNotice error={remove.error} />}
          {query.data && (
            <Button
              title={t("Delete list")}
              secondary
              loading={remove.isPending}
              onPress={() =>
                Alert.alert(
                  t("Delete this list?"),
                  t("Your shopping items will be removed."),
                  [
                    { text: t("Cancel"), style: "cancel" },
                    {
                      text: t("Delete"),
                      style: "destructive",
                      onPress: () => remove.mutate(),
                    },
                  ],
                )
              }
            />
          )}
        </>
      ) : (
        <>
          <Field
            label={t("List name")}
            value={draft.title}
            maxLength={200}
            editable={!create.isPending}
            onChangeText={(title) => setDraft({ ...draft, title })}
          />
          {route.params.draft && (
            <Text style={styles.muted}>
              {t("Review the ingredients and quantities before saving.")}
            </Text>
          )}
          {draft.items.map((item, index) => (
            <View key={index} style={styles.card}>
              <Field
                label={t(`Ingredient ${index + 1}`)}
                value={item.name}
                maxLength={200}
                editable={!create.isPending}
                onChangeText={(name) =>
                  setDraft({
                    ...draft,
                    items: draft.items.map((i, n) =>
                      n === index ? { ...i, name } : i,
                    ),
                  })
                }
              />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t("Quantity")}
                    value={item.quantity}
                    maxLength={100}
                    editable={!create.isPending}
                    onChangeText={(quantity) =>
                      setDraft({
                        ...draft,
                        items: draft.items.map((i, n) =>
                          n === index ? { ...i, quantity } : i,
                        ),
                      })
                    }
                  />
                </View>
                <IconButton
                  name="trash-outline"
                  label={t("Remove item")}
                  disabled={create.isPending}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      items: draft.items.filter((_, n) => n !== index),
                    })
                  }
                />
              </View>
            </View>
          ))}
          <Button
            title={t("+ Ingredient")}
            secondary
            disabled={create.isPending || draft.items.length >= 60}
            onPress={() =>
              setDraft({
                ...draft,
                items: [...draft.items, { name: "", quantity: "" }],
              })
            }
          />
          {create.isError && <ErrorNotice error={create.error} />}
          <Button
            title={t("Save shopping list")}
            loading={create.isPending}
            onPress={() => {
              create.mutate();
            }}
          />
        </>
      )}
    </ScrollView>
  );
}
