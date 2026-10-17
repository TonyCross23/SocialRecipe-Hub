import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation } from "@tanstack/react-query";
import type { AuthStackParams } from "../navigation/types";
import { LanguagePicker } from "../components/LanguagePicker";
import { Button, ErrorNotice, Field, useUI } from "../components/ui";
import {
  dateOnly,
  loginSchema,
  registrationFormSchema,
} from "../lib/validation";
import { recipesApi } from "../api/recipes";
import { useSession } from "../store/session";
import { dateLocale, t } from "../store/language";

export function LoginScreen() {
  return <AuthForm register={false} />;
}
export function RegisterScreen() {
  return <AuthForm register />;
}

function AuthForm({ register }: { register: boolean }) {
  const { styles, colors } = useUI();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParams>>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [showDate, setShowDate] = useState(false);
  const mutation = useMutation({
    mutationFn: async () => {
      const credentials = { email: email.trim().toLowerCase(), password };
      if (!register) {
        await useSession
          .getState()
          .signIn(await recipesApi.login(loginSchema.parse(credentials)));
        return;
      }
      const input = registrationFormSchema.parse({
        ...credentials,
        name,
        confirmPassword,
        dob: dob ? dateOnly(dob) : "",
      });
      const challenge = await recipesApi.register(input);
      setPassword("");
      setConfirmPassword("");
      navigation.navigate("VerifyEmail", {
        requestId: challenge.requestId,
        email: input.email,
      });
    },
  });
  const busy = mutation.isPending;
  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{ width: "100%", maxWidth: 440, alignSelf: "center", flex: 1 }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: register ? 28 : 52,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={{
                  backgroundColor: colors.pale,
                  padding: 9,
                  borderRadius: 12,
                }}
              >
                <Ionicons
                  name="restaurant-outline"
                  size={22}
                  color={colors.brand}
                />
              </View>
              <Text
                style={{ color: colors.ink, fontSize: 18, fontWeight: "800" }}
              >
                SocialRecipe
              </Text>
            </View>
            <LanguagePicker />
          </View>
          <Text style={[styles.title, { marginBottom: 8 }]}>
            {register ? t("Create your account") : t("Welcome back")}
          </Text>
          <Text style={[styles.muted, { marginBottom: 28 }]}>
            {register
              ? t("Join your cooking community.")
              : t("Sign in to your cooking community.")}
          </Text>
          <View style={{ gap: 16 }}>
            {register && (
              <Field
                label={t("Name")}
                autoComplete="name"
                value={name}
                onChangeText={setName}
                maxLength={100}
                editable={!busy}
              />
            )}
            <Field
              label={t("Email")}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              maxLength={254}
              editable={!busy}
            />
            <Field
              label={t("Password")}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={register ? "new-password" : "current-password"}
              value={password}
              onChangeText={setPassword}
              maxLength={128}
              editable={!busy}
            />
            {register ? (
              <>
                <Text style={[styles.muted, { marginTop: -10 }]}>
                  {t("Use at least 12 characters")}
                </Text>
                <Field
                  label={t("Confirm password")}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  maxLength={128}
                  editable={!busy}
                />
                <View style={{ gap: 6 }}>
                  <Text
                    style={{
                      color: colors.ink,
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    {t("Date of birth")}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Choose date of birth")}
                    disabled={busy}
                    onPress={() => setShowDate(true)}
                    style={[
                      styles.input,
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: dob ? colors.ink : colors.muted,
                        fontSize: 16,
                      }}
                    >
                      {dob
                        ? dob.toLocaleDateString(dateLocale(), {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : t("Choose date of birth")}
                    </Text>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={colors.muted}
                    />
                  </Pressable>
                </View>
                {showDate && (
                  <View>
                    <DateTimePicker
                      value={dob ?? new Date(2000, 0, 1)}
                      mode="date"
                      minimumDate={new Date(1900, 0, 1)}
                      maximumDate={new Date()}
                      onChange={(event, value) => {
                        if (Platform.OS === "android") setShowDate(false);
                        if (event.type === "set" && value) setDob(value);
                      }}
                    />
                    {Platform.OS === "ios" && (
                      <Button
                        title={t("Done")}
                        secondary
                        onPress={() => setShowDate(false)}
                      />
                    )}
                  </View>
                )}
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => navigation.navigate("ForgotPassword")}
                style={{ alignSelf: "flex-end", paddingVertical: 6 }}
              >
                <Text style={{ color: colors.brand, fontWeight: "600" }}>
                  {t("Forgot password?")}
                </Text>
              </Pressable>
            )}
            {mutation.isError && <ErrorNotice error={mutation.error} />}
            <Button
              title={register ? t("Create account") : t("Sign in")}
              loading={busy}
              onPress={() => mutation.mutate()}
              style={{ minHeight: 50, marginTop: 4, borderRadius: 12 }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => navigation.navigate(register ? "Login" : "Register")}
            style={{ paddingVertical: 22, alignItems: "center" }}
          >
            <Text
              style={{
                color: colors.brand,
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              {register
                ? t("Already a member? Sign in")
                : t("New here? Create an account")}
            </Text>
          </Pressable>
          {!register && (
            <View
              style={{
                marginTop: "auto",
                paddingTop: 24,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() =>
                  navigation.navigate("Appeal", { email: email.trim() })
                }
                style={{ paddingVertical: 12 }}
              >
                <Text style={[styles.muted, { textAlign: "center" }]}>
                  {t("Account banned? Submit an appeal")}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
