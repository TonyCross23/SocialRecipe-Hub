import { t } from "../store/language";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useMutation } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParams } from "../navigation/types";
import { recoveryApi } from "../api/recovery";
import { Button, ErrorNotice, Field, useUI } from "../components/ui";
import { useLanguage } from "../store/language";
import { loginSchema } from "../lib/validation";
export function ForgotPasswordScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParams, "ForgotPassword">) {
  const { styles } = useUI();
  const [email, setEmail] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      recoveryApi.forgot(
        loginSchema.shape.email.parse(email.trim().toLowerCase()),
        useLanguage.getState().language,
      ),
    onSuccess: ({ requestId }) =>
      navigation.navigate("ResetPassword", {
        requestId,
        email: email.trim().toLowerCase(),
      }),
  });
  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 22, gap: 20 }}
    >
      <Text style={styles.title}>{t("Forgot password?")}</Text>
      <Text style={styles.muted}>
        {t(
          "Enter your account email. If it exists, we'll send a six-digit reset code.",
        )}
      </Text>
      <Field
        label={t("Email")}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        maxLength={254}
        editable={!mutation.isPending}
      />
      {mutation.isError && <ErrorNotice error={mutation.error} />}
      <Button
        title={t("Send reset code")}
        loading={mutation.isPending}
        onPress={() => mutation.mutate()}
      />
    </ScrollView>
  );
}
export function ResetPasswordScreen({
  route,
  navigation,
}: NativeStackScreenProps<AuthStackParams, "ResetPassword">) {
  const { styles } = useUI();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      if (!/^\d{6}$/.test(code))
        throw new Error("Enter the six-digit reset code.");
      if (password.length < 12 || password.length > 128)
        throw new Error("Use 12–128 characters for your new password.");
      if (password !== confirm) throw new Error("New passwords do not match.");
      return recoveryApi.reset(route.params.requestId, code, password);
    },
    onSuccess: () => {
      setCode("");
      setPassword("");
      setConfirm("");
      Alert.alert(t("Password reset"), t("Sign in with your new password."));
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    },
  });
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 22, gap: 20 }}
      >
        <Text style={styles.title}>{t("Reset password")}</Text>
        <Text style={styles.muted}>
          {t(
            "Check your email for a code. It expires in 15 minutes. Password reset does not remove an account ban.",
          )}
        </Text>
        <Text style={styles.body}>{route.params.email}</Text>
        <Field
          label={t("Reset code")}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          editable={!mutation.isPending}
        />
        <Field
          label={t("New password")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={128}
          editable={!mutation.isPending}
        />
        <Field
          label={t("Confirm new password")}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={128}
          editable={!mutation.isPending}
        />
        {mutation.isError && <ErrorNotice error={mutation.error} />}
        <Button
          title={t("Reset password")}
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
        />
        <Button
          title={t("Request another code")}
          secondary
          disabled={mutation.isPending}
          onPress={() => navigation.goBack()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function AppealScreen({
  route,
  navigation,
}: NativeStackScreenProps<AuthStackParams, "Appeal">) {
  const { styles, colors } = useUI();
  const [email, setEmail] = useState(route.params?.email ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const identity = () =>
    loginSchema.parse({ email: email.trim().toLowerCase(), password });
  const status = useMutation({
    mutationFn: () => {
      const credentials = identity();
      return recoveryApi.status(credentials.email, credentials.password);
    },
  });
  const submit = useMutation({
    mutationFn: () => {
      const credentials = identity();
      if (message.trim().length < 20)
        throw new Error("Explain your appeal in at least 20 characters.");
      return recoveryApi.appeal(
        credentials.email,
        credentials.password,
        message.trim(),
      );
    },
    onSuccess: () => {
      Alert.alert(
        t("Appeal submitted"),
        t(
          "An administrator will review your request. Check the response here later.",
        ),
      );
      status.mutate();
    },
  });
  const busy = status.isPending || submit.isPending;
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={{ padding: 22, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t("Account appeal")}</Text>
        <Text style={styles.muted}>
          {t(
            "Verify your account to ask an administrator to review your ban or check their response.",
          )}
        </Text>
        <Field
          label={t("Email")}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            status.reset();
            submit.reset();
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          maxLength={254}
          editable={!busy}
        />
        <Field
          label={t("Password")}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            status.reset();
            submit.reset();
          }}
          secureTextEntry
          autoCapitalize="none"
          maxLength={128}
          editable={!busy}
        />
        <Button
          title={t("Check appeal status")}
          secondary
          loading={status.isPending}
          disabled={submit.isPending}
          onPress={() => status.mutate()}
        />
        {status.data && (
          <View style={[styles.card, { gap: 8 }]}>
            <Text style={{ color: colors.brand, fontWeight: "700" }}>
              {status.data.status === "ACTIVE"
                ? t("Account active")
                : t("Account banned")}
            </Text>
            {!!status.data.bannedReason && (
              <Text style={styles.body}>{status.data.bannedReason}</Text>
            )}
            {status.data.appeal ? (
              <>
                <Text style={styles.heading}>
                  {t(status.data.appeal.status)}
                </Text>
                <Text style={styles.body}>{status.data.appeal.message}</Text>
                {!!status.data.appeal.response && (
                  <>
                    <Text style={styles.muted}>{t("Admin response")}</Text>
                    <Text style={styles.body}>
                      {status.data.appeal.response}
                    </Text>
                  </>
                )}
              </>
            ) : (
              <Text style={styles.muted}>{t("No appeal submitted yet.")}</Text>
            )}
            {status.data.status === "ACTIVE" && (
              <Button
                title={t("Sign in")}
                onPress={() => {
                  setPassword("");
                  navigation.navigate("Login");
                }}
              />
            )}
          </View>
        )}
        {status.data?.status !== "ACTIVE" &&
          status.data?.appeal?.status !== "PENDING" && (
            <>
              <Field
                label={t("Your message to the administrator")}
                placeholder={t("Explain why your account should be reviewed…")}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={2000}
                editable={!busy}
              />
              <Button
                title={t("Submit appeal")}
                loading={submit.isPending}
                disabled={status.isPending}
                onPress={() => submit.mutate()}
              />
            </>
          )}
        {status.isError && <ErrorNotice error={status.error} />}
        {submit.isError && <ErrorNotice error={submit.error} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
