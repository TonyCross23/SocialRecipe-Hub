import { t } from "../store/language";
import { useState } from "react";
import { Modal, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { recipesApi } from "../api/recipes";
import type { ReportTarget } from "../api/types";
import { reportSchema } from "../lib/validation";
import { Button, ErrorNotice, Field, useUI } from "./ui";

export function ReportModal({
  target,
  onClose,
}: {
  target: ReportTarget;
  onClose: () => void;
}) {
  const { styles } = useUI();

  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () => recipesApi.report(target, reportSchema.parse(reason)),
    onSuccess: onClose,
  });
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <SafeAreaView style={styles.screen}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Text style={styles.title}>{t("Report content")}</Text>
          <Text style={styles.muted}>
            {t(
              "Help keep our kitchen welcoming. Tell us why this content is harmful.",
            )}
          </Text>
          {[
            "Offensive or toxic language",
            "Harassment or hate speech",
            "Spam or misleading content",
          ].map((value) => (
            <Button
              key={value}
              title={value}
              secondary
              disabled={mutation.isPending}
              onPress={() => setReason(t(value))}
            />
          ))}
          <Field
            label={t("Reason")}
            multiline
            maxLength={2000}
            value={reason}
            onChangeText={setReason}
            editable={!mutation.isPending}
          />
          {mutation.isError && <ErrorNotice error={mutation.error} />}
          <Button
            title={t("Submit report")}
            loading={mutation.isPending}
            disabled={reason.trim().length < 10}
            onPress={() => mutation.mutate()}
          />
          <Button
            title={t("Cancel")}
            secondary
            disabled={mutation.isPending}
            onPress={onClose}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
