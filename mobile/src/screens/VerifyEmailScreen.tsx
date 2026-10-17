import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParams } from "../navigation/types";
import { Button, ErrorNotice, Field, useUI } from "../components/ui";
import { recipesApi } from "../api/recipes";
import { t } from "../store/language";
export function VerifyEmailScreen({
  route,
  navigation,
}: NativeStackScreenProps<AuthStackParams, "VerifyEmail">) {
  const { styles, colors } = useUI();
  const [code, setCode] = useState("");
  const [resendAt, setResendAt] = useState(Date.now() + 60000);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const verify = useMutation({
    mutationFn: () =>
      recipesApi.verifyRegistration(route.params.requestId, code),
    onSuccess: () => {
      setCode("");
      Alert.alert(
        t("Account created"),
        t("Email verified. Sign in with your email and password."),
      );
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    },
  });
  const resend = useMutation({
    mutationFn: () => recipesApi.resendRegistration(route.params.requestId),
    onSuccess: ({ resendAfter }) => {
      setCode("");
      verify.reset();
      setResendAt(Date.now() + resendAfter * 1000);
      Alert.alert(t("Code sent"), t("Check your inbox for the new code."));
    },
  });
  const busy = verify.isPending || resend.isPending;
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, padding: 24 }}
      >
        <View
          style={{ width: "100%", maxWidth: 440, alignSelf: "center", gap: 20 }}
        >
          <Ionicons name="mail-outline" size={42} color={colors.brand} />
          <Text style={styles.title}>{t("Verify your email")}</Text>
          <View style={{ gap: 6 }}>
            <Text style={styles.body}>
              {t("Enter the six-digit code sent to:")}
            </Text>
            <Text selectable style={[styles.body, { fontWeight: "700" }]}>
              {route.params.email}
            </Text>
          </View>
          <Field
            label={t("Verification code")}
            value={code}
            onChangeText={(value) => setCode(value.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            editable={!busy}
          />
          <Text style={styles.muted}>
            {t(
              "The code expires in 15 minutes. Your account is created only after verification.",
            )}
          </Text>
          {verify.isError && <ErrorNotice error={verify.error} />}
          {resend.isError && <ErrorNotice error={resend.error} />}
          <Button
            title={t("Verify and create account")}
            loading={verify.isPending}
            disabled={busy || code.length !== 6}
            onPress={() => verify.mutate()}
          />
          <Button
            title={
              remaining > 0
                ? `${t("Resend code")} (${remaining}s)`
                : t("Resend code")
            }
            secondary
            disabled={busy || remaining > 0}
            loading={resend.isPending}
            onPress={() => resend.mutate()}
          />
          <Text style={styles.muted}>
            {t(
              "Check your spam folder too. To change your email, go back to registration.",
            )}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
