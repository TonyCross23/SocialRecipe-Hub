import { RecipeDetails } from "../components/RecipeDetails";
import { ActivityIndicator, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParams } from "../navigation/types";
import { recipesApi } from "../api/recipes";
import { PostCard } from "../components/PostCard";
import { ErrorNotice, useUI } from "../components/ui";
export function PostScreen({
  route,
}: NativeStackScreenProps<RootStackParams, "Post">) {
  const { styles } = useUI();
  const query = useQuery({
    queryKey: ["post", route.params.postId],
    queryFn: ({ signal }) => recipesApi.post(route.params.postId, signal),
  });
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {query.isPending ? (
        <ActivityIndicator />
      ) : query.isError ? (
        <ErrorNotice
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <PostCard post={query.data.post} />
          {query.data.post.recipe && (
            <RecipeDetails
              key={query.data.post.updatedAt}
              title={query.data.post.title}
              recipe={query.data.post.recipe}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}
