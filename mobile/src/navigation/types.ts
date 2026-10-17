import type { ShoppingDraft } from "../api/library";
import type { NavigatorScreenParams } from "@react-navigation/native";
import type { SocialUser, Post } from "../api/types";
export type TabParams = {
  Home: undefined;
  People: undefined;
  Create: undefined;
  Notifications: undefined;
  Profile: undefined;
};
export type RootStackParams = {
  Tabs: NavigatorScreenParams<TabParams> | undefined;
  UserProfile: { user: SocialUser };
  Connections: { user: SocialUser; kind: "followers" | "following" };
  Comments: { postId: string };
  Post: { postId: string };
  EditPost: { post: Post };
  Likes: { postId: string };
  Saved: undefined;
  ShoppingLists: undefined;
  ShoppingList: { id?: string; draft?: ShoppingDraft };
  Filters: undefined;
  Search: undefined;
  Assistant: undefined;
  Settings: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
};
export type AuthStackParams = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { requestId: string; email: string };
  ForgotPassword: undefined;
  ResetPassword: { requestId: string; email: string };
  Appeal: { email?: string } | undefined;
};
