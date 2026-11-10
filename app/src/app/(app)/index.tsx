import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { Question } from "@/components/Question";
import { Screen } from "@/components/Screen";
import { TextLink } from "@/components/TextLink";
import { api } from "@/lib/api";
import { conversationCache } from "@/lib/conversationCache";
import { copy } from "@/lib/copy";
import { supabase } from "@/lib/supabase";
import { space } from "@/lib/theme";
import { userMessageFor } from "@/lib/userMessage";

export default function MainScreen() {
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const trimmed = word.trim();

  async function start() {
    if (!trimmed || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const conversation = await api.startSession(trimmed);
      conversationCache.put(conversation);
      setWord("");
      router.push({ pathname: "/chat/[id]", params: { id: conversation.session.id } });
    } catch (err) {
      setNotice(userMessageFor(err, copy.loadFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.links}>
        <TextLink label={copy.linkArchive} onPress={() => router.push("/archive")} />
        <TextLink label={copy.linkDiaries} onPress={() => router.push("/diaries")} />
      </View>
      <View style={styles.body}>
        <Question>{copy.openingQuestion}</Question>
        <View style={styles.row}>
          <Field
            value={word}
            onChangeText={setWord}
            placeholder={copy.oneWordPlaceholder}
            maxLength={30}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={start}
            accessibilityLabel={copy.oneWordPlaceholder}
            style={styles.input}
          />
          <Button label={copy.start} onPress={start} disabled={!trimmed} loading={busy} />
        </View>
        {notice ? <Notice message={notice} /> : null}
      </View>
      <View style={styles.footer}>
        <TextLink label={copy.signOut} onPress={() => supabase.auth.signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: "row", justifyContent: "flex-end", gap: space.md },
  body: { flex: 1, justifyContent: "center" },
  row: { flexDirection: "row", gap: space.sm },
  input: { flex: 1, minWidth: 0 },
  footer: { alignItems: "center" },
});
