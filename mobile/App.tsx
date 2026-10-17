import { t } from "./src/store/language";
import { useLanguage } from "./src/store/language";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { queryClient } from "./src/lib/query";
import { useAppearance } from "./src/store/appearance";
import { useSession } from "./src/store/session";
import { recipesApi } from "./src/api/recipes";
import { Button, ErrorNotice, useUI } from "./src/components/ui";

export default function App() {
  const { styles, colors, dark } = useUI();

  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const bootstrap = useCallback(async () => {
    setBooting(true);
    setError(null);
    try {
      await useLanguage.getState().hydrate();
      await useAppearance.getState().hydrate();
      if (!useSession.getState().ready) await useSession.getState().hydrate();
      if (useSession.getState().refreshToken) {
        const { user } = await recipesApi.me();
        useSession.getState().setUser(user);
      }
    } catch (failure) {
      if (useSession.getState().refreshToken) setError(failure);
    } finally {
      setBooting(false);
    }
  }, []);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      focusManager.setFocused(state === "active"),
    );
    const unsubscribe = useSession.subscribe((state, previous) => {
      if (previous.user && !state.user) {
        void queryClient.cancelQueries();
        queryClient.clear();
      }
    });
    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, []);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={dark ? "light" : "dark"} />
        {booting || error ? (
          <View
            style={[
              styles.screen,
              { padding: 28, justifyContent: "center", gap: 20 },
            ]}
          >
            <Text style={styles.title}>{t("SocialRecipe Hub")}</Text>
            <Text style={styles.muted}>
              {t("Recipes worth sharing. People worth cooking with.")}
            </Text>
            {booting ? (
              <ActivityIndicator size="large" color={colors.brand} />
            ) : (
              <>
                <ErrorNotice
                  error={error}
                  retry={() => {
                    void bootstrap();
                  }}
                />
                <Button
                  title={t("Return to sign in")}
                  secondary
                  onPress={() => {
                    void useSession
                      .getState()
                      .clear()
                      .then(() => setError(null));
                  }}
                />
              </>
            )}
          </View>
        ) : (
          <AppNavigator />
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
