import { router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Centered";
import { Notice } from "@/components/Notice";
import { Screen } from "@/components/Screen";
import { api } from "@/lib/api";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/format";
import { colors, font, space } from "@/lib/theme";
import { useRemote } from "@/lib/useRemote";

export default function DiaryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fetcher = useCallback(async () => (await api.getDiary(id)).diary, [id]);
  const { state, reload } = useRemote(fetcher);

  return (
    <Screen>
      {state.status === "loading" ? <Loading /> : null}
      {state.status === "failed" ? <Notice message={copy.loadFailed} actionLabel={copy.retry} onAction={reload} /> : null}
      {state.status === "ready" ? (
        <>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.meta}>{formatDate(state.data.created_at)}</Text>
            <Text style={styles.title}>{state.data.seed_word}</Text>
            <Text style={styles.body} selectable>
              {state.data.content}
            </Text>
          </ScrollView>
          <View style={styles.actions}>
            <Button label={copy.linkDiaries} variant="quiet" onPress={() => router.replace("/diaries")} />
            <Button label={copy.goStart} variant="quiet" onPress={() => router.dismissTo("/")} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space.lg },
  meta: { color: colors.faint, fontSize: font.small },
  title: { fontSize: font.question, fontWeight: "700", color: colors.text, marginTop: space.xs, marginBottom: space.md },
  body: { fontSize: font.body + 1, lineHeight: 30, color: colors.text },
  actions: { gap: space.sm },
});
