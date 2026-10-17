import { VerifyEmailScreen } from "../screens/VerifyEmailScreen";
import { t } from "../store/language";
import {
  ForgotPasswordScreen,
  ResetPasswordScreen,
  AppealScreen,
} from "../screens/RecoveryScreens";
import { EditProfileScreen } from "../screens/EditProfileScreen";
import { ChangePasswordScreen } from "../screens/ChangePasswordScreen";
import { useCallback } from "react";
import { z } from "zod";
import { PushRegistration } from "../components/PushRegistration";
import { SavedScreen } from "../screens/SavedScreen";
import { ShoppingListsScreen } from "../screens/ShoppingListsScreen";
import { ShoppingListScreen } from "../screens/ShoppingListScreen";
import { FiltersScreen } from "../screens/FiltersScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { EditPostScreen } from "../screens/EditPostScreen";
import { PostScreen } from "../screens/PostScreen";
import { LikesScreen } from "../screens/LikesScreen";
import { View, Text } from "react-native";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  useNavigation,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSession } from "../store/session";
import type { AuthStackParams, RootStackParams, TabParams } from "./types";
import { LoginScreen, RegisterScreen } from "../screens/AuthScreen";
import { FeedScreen } from "../screens/FeedScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ConnectionsScreen } from "../screens/ConnectionsScreen";
import { CreatePostScreen } from "../screens/CreatePostScreen";
import { CommentsScreen } from "../screens/CommentsScreen";
import { AssistantScreen } from "../screens/AssistantScreen";
import { PeopleScreen } from "../screens/PeopleScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { NotificationBanner } from "../components/NotificationBanner";
import { useNotificationSummary } from "../hooks/useCommunity";
import { IconButton, useUI } from "../components/ui";
const Stack = createNativeStackNavigator<RootStackParams>();
const Auth = createNativeStackNavigator<AuthStackParams>();
const Tab = createBottomTabNavigator<TabParams>();
const icons = {
  Home: ["home-outline", "home"],
  People: ["people-outline", "people"],
  Create: ["add-circle-outline", "add-circle"],
  Notifications: ["notifications-outline", "notifications"],
  Profile: ["person-circle-outline", "person-circle"],
} as const;
function Tabs() {
  const { colors } = useUI();
  const summary = useNotificationSummary();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const unread = summary.data?.unreadCount ?? 0;
  const openPush = useCallback(
    (raw: unknown) => {
      const data = z.object({ postId: z.uuid().optional() }).safeParse(raw);
      if (data.success && data.data.postId)
        nav.navigate("Post", { postId: data.data.postId });
      else nav.navigate("Tabs", { screen: "Notifications" });
    },
    [nav],
  );
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.muted,
          tabBarShowLabel: false,
          tabBarIcon: ({ size, color, focused }) => (
            <Ionicons
              name={icons[route.name][focused ? 1 : 0]}
              size={route.name === "Create" ? 32 : size}
              color={color}
            />
          ),
          headerRight: () => (
            <View style={{ marginRight: 12 }}>
              <IconButton
                name="settings-outline"
                label={t("Settings")}
                onPress={() => nav.push("Settings")}
              />
            </View>
          ),
        })}
      >
        <Tab.Screen
          name="Home"
          component={FeedScreen}
          options={{
            title: t("Home"),
            headerTitle: () => (
              <Text
                style={{
                  fontWeight: "800",
                  fontSize: 25,
                  letterSpacing: -0.8,
                  color: colors.brand,
                }}
              >
                {t("SocialRecipe")}
              </Text>
            ),
            headerRight: () => (
              <View style={{ flexDirection: "row", gap: 8, marginRight: 12 }}>
                <IconButton
                  name="search"
                  label={t("Search posts and users")}
                  onPress={() => nav.push("Search")}
                />
                <IconButton
                  name="sparkles-outline"
                  label={t("AI kitchen")}
                  onPress={() => nav.push("Assistant")}
                />
              </View>
            ),
          }}
        />
        <Tab.Screen
          name="People"
          component={PeopleScreen}
          options={{
            title: t("Friends"),
            tabBarAccessibilityLabel: "Friends and following",
          }}
        />
        <Tab.Screen
          name="Create"
          component={CreatePostScreen}
          options={{
            title: t("Create post"),
            headerShown: false,
            tabBarAccessibilityLabel: "Create a post",
          }}
        />
        <Tab.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{
            title: t("Notifications"),
            tabBarBadge: unread ? (unread > 99 ? "99+" : unread) : undefined,
            tabBarBadgeStyle: { backgroundColor: "#E53950", color: "#fff" },
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: t("My profile"),
            tabBarAccessibilityLabel: "My profile",
          }}
        />
      </Tab.Navigator>
      <PushRegistration onOpen={openPush} />
      <NotificationBanner
        onOpen={() => nav.navigate("Tabs", { screen: "Notifications" })}
      />
    </View>
  );
}
export function AppNavigator() {
  const { colors, dark } = useUI();
  const user = useSession((s) => s.user);
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.brand,
      background: colors.background,
      card: colors.surface,
      text: colors.ink,
      border: colors.border,
    },
  };
  return (
    <NavigationContainer theme={theme}>
      {user ? (
        <Stack.Navigator
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.ink,
          }}
        >
          <Stack.Screen
            name="Tabs"
            component={Tabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="UserProfile"
            component={ProfileScreen}
            options={{ title: t("Profile") }}
          />
          <Stack.Screen
            name="Connections"
            component={ConnectionsScreen}
            options={{ title: t("Friends") }}
          />
          <Stack.Screen
            name="Post"
            component={PostScreen}
            options={{ title: t("Post") }}
          />
          <Stack.Screen
            name="EditPost"
            component={EditPostScreen}
            options={{ presentation: "modal", headerShown: false }}
          />
          <Stack.Screen
            name="Comments"
            component={CommentsScreen}
            options={{
              presentation: "transparentModal",
              headerShown: false,
              animation: "fade",
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
          <Stack.Screen
            name="Likes"
            component={LikesScreen}
            options={{
              title: t("People who liked this"),
              presentation: "formSheet",
              sheetAllowedDetents: [0.7, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="Saved"
            component={SavedScreen}
            options={{ title: t("Saved recipes") }}
          />
          <Stack.Screen
            name="ShoppingLists"
            component={ShoppingListsScreen}
            options={{ title: t("Shopping lists") }}
          />
          <Stack.Screen
            name="ShoppingList"
            component={ShoppingListScreen}
            options={{ title: t("Shopping list") }}
          />
          <Stack.Screen
            name="Filters"
            component={FiltersScreen}
            options={{ title: t("Blocked & muted") }}
          />
          <Stack.Screen
            name="Search"
            component={SearchScreen}
            options={{ title: t("Search") }}
          />
          <Stack.Screen
            name="Assistant"
            component={AssistantScreen}
            options={{ title: t("AI kitchen") }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ title: t("Edit profile") }}
          />
          <Stack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
            options={{ title: t("Change password") }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: t("Settings") }}
          />
        </Stack.Navigator>
      ) : (
        <Auth.Navigator screenOptions={{ headerShown: false }}>
          <Auth.Screen name="Login" component={LoginScreen} />
          <Auth.Screen name="Register" component={RegisterScreen} />
          <Auth.Screen
            name="VerifyEmail"
            component={VerifyEmailScreen}
            options={{ headerShown: true, title: t("Verify email") }}
          />
          <Auth.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ headerShown: true, title: t("Forgot password") }}
          />
          <Auth.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{ headerShown: true, title: t("Reset password") }}
          />
          <Auth.Screen
            name="Appeal"
            component={AppealScreen}
            options={{ headerShown: true, title: t("Account appeal") }}
          />
        </Auth.Navigator>
      )}
    </NavigationContainer>
  );
}
