import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";
import { Bubble } from "@/components/Bubble";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Centered";
import { ChoiceChips } from "@/components/ChoiceChips";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { Screen } from "@/components/Screen";
import { copy } from "@/lib/copy";
import { handleEnterToSend } from "@/lib/enterToSend";
import { colors, font, space } from "@/lib/theme";
import type { Message } from "@/lib/types";
import { useConversation } from "@/lib/useConversation";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useConversation(id);
  const [input, setInput] = useState("");
  const list = useRef<FlatList<Message>>(null);

  async function send(text: string) {
    if (!text.trim() || c.sending) return;
    setInput("");
    const ok = await c.send(text);
    if (!ok) setInput(text); // 실패해도 쓴 글은 그대로
  }

  const finish = () => router.push({ pathname: "/edit/[id]", params: { id } });

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: c.seedWord }} />
      {c.load === "loading" ? <Loading /> : null}
      {c.load === "failed" ? (
        <View style={styles.center}>
          <Notice message={copy.loadFailed} actionLabel={copy.retry} onAction={c.retry} />
        </View>
      ) : null}
      {c.load === "completed" ? (
        <View style={styles.center}>
          <Notice message="이미 일기로 남긴 이야기야." actionLabel={copy.linkDiaries} onAction={() => router.replace("/diaries")} />
        </View>
      ) : null}
      {c.load === "ready" ? (
        <>
          <FlatList
            ref={list}
            data={c.messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <Bubble role={item.role} content={item.content} />}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
            onLayout={() => list.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={c.sending ? <Text style={styles.thinking}>{copy.thinking}</Text> : undefined}
          />
          <View style={styles.bottom}>
            {c.notice ? <Notice message={c.notice} /> : null}
            {c.suggestFinish && !c.sending ? <Text style={styles.hint}>{copy.finishHint}</Text> : null}
            <ChoiceChips choices={c.choices} onPick={send} disabled={c.sending} />
            <View style={styles.row}>
              <Field
                value={input}
                onChangeText={setInput}
                placeholder={copy.answerPlaceholder}
                maxLength={2000}
                multiline
                accessibilityLabel={copy.answerPlaceholder}
                style={styles.input}
                onSubmitEditing={() => send(input)}
                onKeyPress={Platform.OS === "web" ? (e) => handleEnterToSend(e, () => send(input)) : undefined}
                submitBehavior="submit"
                returnKeyType="send"
              />
              <Button label={copy.send} onPress={() => send(input)} disabled={!input.trim() || c.sending} />
            </View>
          </View>
        </>
      ) : null}
      {/* "여기까지 할래"는 어떤 상태에서도 보인다 */}
      {c.load !== "completed" ? (
        <View style={styles.finish}>
          <Button label={copy.finish} variant="quiet" onPress={finish} disabled={c.sending || c.load !== "ready"} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", paddingHorizontal: space.lg },
  list: { paddingHorizontal: space.md, paddingVertical: space.md },
  thinking: { color: colors.faint, fontSize: font.question, paddingHorizontal: space.sm },
  bottom: { paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  hint: { color: colors.subtle, fontSize: font.small, marginBottom: space.sm },
  row: { flexDirection: "row", gap: space.sm, alignItems: "flex-end" },
  input: { flex: 1, minWidth: 0, maxHeight: 120 },
  finish: { paddingHorizontal: space.md, paddingVertical: space.sm },
});
