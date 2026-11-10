import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Centered";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { Question } from "@/components/Question";
import { Screen } from "@/components/Screen";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/apiError";
import { copy } from "@/lib/copy";
import { localDraft } from "@/lib/localDraft";
import { colors, font, space } from "@/lib/theme";
import { userMessageFor } from "@/lib/userMessage";

export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [text, setText] = useState<string | null>(null);
  const [seedWord, setSeedWord] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  async function loadDraft() {
    setLoadFailed(false);
    try {
      const [saved, server] = await Promise.all([localDraft.get(id), api.getDraft(id)]);
      setSeedWord(server.seedWord);
      setText(saved ?? server.draft);
    } catch {
      setLoadFailed(true);
    }
  }

  useEffect(() => {
    void loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function change(value: string) {
    setText(value);
    void localDraft.set(id, value); // 고친 내용은 기기에 바로 보관
  }

  async function save() {
    if (!text?.trim() || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const { diary } = await api.complete(id, text);
      await localDraft.clear(id);
      router.dismissAll();
      router.push({ pathname: "/diaries/[id]", params: { id: diary.id } });
    } catch (err) {
      if (err instanceof ApiError && err.kind === "conflict") {
        await localDraft.clear(id);
        router.replace("/diaries");
        return;
      }
      setNotice(userMessageFor(err, copy.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  if (loadFailed) {
    return (
      <Screen>
        <View style={styles.center}>
          <Notice message={copy.loadFailed} actionLabel={copy.retry} onAction={loadDraft} />
        </View>
      </Screen>
    );
  }
  if (text === null) return <Loading />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {seedWord ? <Text style={styles.seed}>{seedWord}</Text> : null}
        <Question>{copy.editTitle}</Question>
        <Field
          value={text}
          onChangeText={change}
          multiline
          placeholder={copy.editPlaceholder}
          accessibilityLabel="일기 내용"
          style={styles.editor}
          textAlignVertical="top"
        />
        {notice ? <Notice message={notice} /> : null}
      </ScrollView>
      <View style={styles.actions}>
        <Button label={copy.save} onPress={save} disabled={!text.trim()} loading={saving} />
        <Button label={copy.backToChat} variant="quiet" onPress={() => router.back()} disabled={saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center" },
  scroll: { paddingBottom: space.lg },
  seed: { color: colors.accent, fontWeight: "700", fontSize: font.small, marginBottom: space.sm },
  editor: { minHeight: 220, lineHeight: 26, paddingTop: space.md },
  actions: { gap: space.sm, paddingTop: space.sm },
});
