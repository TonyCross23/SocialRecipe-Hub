import { t } from "../store/language";
import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { libraryApi, type FilterKind } from "../api/library";
export function useSafety(userId: string, onBlocked?: () => void) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ kind, enabled }: { kind: FilterKind; enabled: boolean }) =>
      libraryApi.filter(userId, kind, enabled),
    onSuccess: async (_result, { kind, enabled }) => {
      if (kind === "BLOCK" && enabled) onBlocked?.();
      await client.cancelQueries();
      // Remove cached relationship states after a block has also removed follows.
      await client.resetQueries({ queryKey: ["relationship"] });
      await client.invalidateQueries();
    },
    onError: (error) =>
      Alert.alert(
        t("Could not update preference"),
        t(error instanceof Error ? error.message : "Please try again."),
      ),
  });
  const confirm = (kind: FilterKind, name: string, enabled = true) => {
    if (mutation.isPending) return;
    Alert.alert(
      t(
        `${enabled ? (kind === "BLOCK" ? "Block" : "Mute") : kind === "BLOCK" ? "Unblock" : "Unmute"} ${name}?`,
      ),
      t(
        enabled
          ? kind === "BLOCK"
            ? "You will not see each other's posts or profiles. Both follow connections will be removed."
            : "Their posts and notifications will be hidden. You can still visit their profile."
          : "This user will be visible again. Removed follow connections are not restored.",
      ),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t(enabled ? (kind === "BLOCK" ? "Block" : "Mute") : "Confirm"),
          style: kind === "BLOCK" && enabled ? "destructive" : "default",
          onPress: () => mutation.mutate({ kind, enabled }),
        },
      ],
    );
  };
  return { confirm, pending: mutation.isPending };
}
