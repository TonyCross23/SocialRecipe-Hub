import { t, useLanguage } from "../store/language";
import { libraryApi } from "../api/library";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParams } from "../navigation/types";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  askAssistant,
  assistantStatus,
  chatContext,
  type ChatMessage,
} from "../api/assistant";
import { Button, ErrorNotice, useUI } from "../components/ui";
export function AssistantScreen() {
  const { styles, colors } = useUI();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const shopping = useMutation({
    mutationFn: (source: string) => libraryApi.extractList(source),
    onSuccess: ({ draft }) => nav.push("ShoppingList", { draft }),
  });
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scroll = useRef<ScrollView>(null);
  const sending = useRef(false);
  const status = useQuery({
    queryKey: ["assistantStatus"],
    queryFn: ({ signal }) => assistantStatus(signal),
    refetchOnMount: "always",
  });
  const mutation = useMutation({
    mutationFn: (question: string) =>
      askAssistant(
        chatContext(messages, question),
        useLanguage.getState().language,
      ),
    onSuccess: (answer, question) => {
      setMessages((items) => [
        ...items,
        { role: "user", content: question },
        { role: "assistant", content: answer },
      ]);
      setMessage("");
    },
    onSettled: () => {
      sending.current = false;
    },
  });
  function send() {
    if (!message.trim() || sending.current) return;
    sending.current = true;
    mutation.mutate(message.trim());
  }
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <View
        style={[styles.row, { padding: 12, backgroundColor: colors.surface }]}
      >
        <Ionicons name="sparkles" color={colors.brand} size={25} />
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>{t("AI Cook")}</Text>
          <Text style={styles.muted}>{t("Your cooking conversation")}</Text>
        </View>
        <Button
          title={t("New chat")}
          secondary
          disabled={mutation.isPending}
          onPress={() => {
            setMessages([]);
            mutation.reset();
          }}
        />
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { flexGrow: 1 }]}
        onContentSizeChange={() =>
          scroll.current?.scrollToEnd({ animated: true })
        }
      >
        {!messages.length && (
          <View style={{ gap: 14, paddingVertical: 25 }}>
            <Text style={styles.title}>{t("What’s cooking today?")}</Text>
            <Text style={styles.body}>
              မေးချင်တာ မေးလိုက်ပါ။ ဟင်းချက်နည်း၊ ပါဝင်ပစ္စည်းနဲ့
              အစားထိုးသုံးလို့ရတာတွေ အတူစဉ်းစားကြမယ်။
            </Text>
            {[
              "ကြက်ဥနဲ့ ထမင်းရှိတယ်။ ဘာချက်လို့ရမလဲ?",
              "မုန့်ဟင်းခါး ချက်နည်းပြောပြပါ",
              "Help me plan dinner for two",
            ].map((prompt) => (
              <Pressable
                key={prompt}
                onPress={() => setMessage(prompt)}
                style={styles.card}
              >
                <Text style={styles.body}>{prompt}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {messages.map((item, i) => (
          <View
            key={i}
            style={{
              alignSelf: item.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "92%",
              borderRadius: 18,
              padding: 14,
              backgroundColor:
                item.role === "user" ? colors.action : colors.surface,
              gap: 5,
            }}
          >
            {item.role === "assistant" && (
              <Text style={{ color: colors.brand, fontWeight: "700" }}>
                {t("✦ AI Cook")}
              </Text>
            )}
            <Text
              selectable
              style={[
                styles.body,
                { color: item.role === "user" ? colors.white : colors.ink },
              ]}
            >
              {item.content}
            </Text>
            {item.role === "assistant" && (
              <Button
                title={t("Make shopping list")}
                secondary
                loading={
                  shopping.isPending && shopping.variables === item.content
                }
                disabled={shopping.isPending}
                onPress={() => shopping.mutate(item.content)}
              />
            )}
          </View>
        ))}
        {mutation.isPending && (
          <View style={styles.card}>
            <Text style={styles.body}>{mutation.variables}</Text>
            <View style={styles.row}>
              <ActivityIndicator color={colors.brand} />
              <Text style={styles.muted}>{t("AI Cook is thinking…")}</Text>
            </View>
          </View>
        )}
        {status.data?.configured === false && (
          <View style={styles.card}>
            <Text style={styles.heading}>
              {t("AI Cook is waiting to connect")}
            </Text>
            <Text style={styles.muted}>
              {t(
                "The administrator needs to connect the AI service. Your question will stay here.",
              )}
            </Text>
            <Button
              title={t("Check connection")}
              secondary
              loading={status.isFetching}
              onPress={() => {
                void status.refetch();
              }}
            />
          </View>
        )}
        {shopping.isError && <ErrorNotice error={shopping.error} />}
        {status.isError && (
          <ErrorNotice
            error={status.error}
            retry={() => {
              void status.refetch();
            }}
          />
        )}
        {mutation.isError && (
          <ErrorNotice error={mutation.error} retry={send} />
        )}
      </ScrollView>
      <View
        style={{
          backgroundColor: colors.surface,
          padding: 12,
          borderTopWidth: 0.5,
          borderColor: colors.border,
        }}
      >
        <View style={styles.row}>
          <TextInput
            accessibilityLabel={t("Ask AI Cook")}
            placeholder={t("Ask AI Cook…")}
            placeholderTextColor={colors.muted}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
            editable={!mutation.isPending}
            style={[
              styles.input,
              { flex: 1, maxHeight: 120, borderRadius: 24 },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Send question")}
            disabled={
              mutation.isPending ||
              !message.trim() ||
              status.data?.configured === false
            }
            onPress={send}
            style={{
              padding: 12,
              opacity:
                mutation.isPending ||
                !message.trim() ||
                status.data?.configured === false
                  ? 0.4
                  : 1,
            }}
          >
            <Ionicons name="send" size={25} color={colors.brand} />
          </Pressable>
        </View>
        <Text style={[styles.muted, { textAlign: "center", fontSize: 11 }]}>
          {t(
            "Questions are sent to Groq. Chat history lasts while this screen is open.",
          )}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
