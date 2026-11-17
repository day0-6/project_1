import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Loading } from "@/components/Centered";
import { DmBubble, TypingBubble } from "@/components/dm/DmBubble";
import { DmComposer } from "@/components/dm/DmComposer";
import { DmHeader } from "@/components/dm/DmHeader";
import { QuickReplies } from "@/components/dm/QuickReplies";
import { TypingDots } from "@/components/dm/TypingDots";
import { Notice } from "@/components/Notice";
import { Screen } from "@/components/Screen";
import { copy } from "@/lib/copy";
import { dm, formatChatTime, toDmLines, type DmLine } from "@/lib/dm";
import { useConversation } from "@/lib/useConversation";
import { useStaggeredReveal } from "@/lib/useStaggeredReveal";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useConversation(id);
  const [input, setInput] = useState("");
  const list = useRef<FlatList<DmLine>>(null);

  const lines = useMemo(() => toDmLines(c.messages), [c.messages]);
  const { visible, revealing } = useStaggeredReveal(lines, c.load === "ready", c.fresh);
  const typing = c.sending || revealing;
  const startedAt = c.messages[0]?.created_at;

  async function send(text: string) {
    if (!text.trim() || c.sending) return;
    setInput("");
    const ok = await c.send(text);
    if (!ok) setInput(text); // 실패해도 쓴 글은 그대로
  }

  const finish = () => router.push({ pathname: "/edit/[id]", params: { id } });
  const scrollToEnd = () => list.current?.scrollToEnd({ animated: true });

  return (
    <Screen padded={false} background={dm.background}>
      <DmHeader subtitle={c.seedWord ? `'${c.seedWord}' 이야기 중` : "질문만 하는 친구"} />
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
            data={visible}
            keyExtractor={(l) => l.key}
            renderItem={({ item }) => <DmBubble line={item} />}
            contentContainerStyle={styles.list}
            onContentSizeChange={scrollToEnd}
            onLayout={() => list.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={startedAt ? <Text style={styles.time}>{formatChatTime(startedAt)}</Text> : undefined}
            ListFooterComponent={
              typing ? (
                <TypingBubble>
                  <TypingDots />
                </TypingBubble>
              ) : undefined
            }
          />
          <View style={styles.bottom}>
            {c.notice ? <Notice message={c.notice} /> : null}
            {!typing ? <QuickReplies choices={c.choices} onPick={send} disabled={c.sending} /> : null}
            {c.suggestFinish && !typing ? <Text style={styles.hint}>{copy.finishHint}</Text> : null}
            <DmComposer value={input} onChange={setInput} onSend={() => send(input)} disabled={c.sending} />
          </View>
        </>
      ) : null}
      {/* "여기까지 할래"는 어떤 상태에서도 보인다 */}
      {c.load !== "completed" ? (
        <Pressable
          accessibilityRole="button"
          onPress={finish}
          disabled={c.sending || c.load !== "ready"}
          style={({ pressed }) => [styles.finish, pressed && styles.finishPressed]}
        >
          <Text style={styles.finishLabel}>{copy.finish}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  list: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  time: { textAlign: "center", color: dm.meta, fontSize: 12, marginBottom: 14, fontWeight: "500" },
  bottom: { paddingHorizontal: 12, paddingTop: 6 },
  hint: { color: dm.meta, fontSize: 13, textAlign: "center", marginBottom: 8 },
  finish: { alignSelf: "center", marginVertical: 8, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999 },
  finishPressed: { backgroundColor: dm.aiBubble },
  finishLabel: { color: dm.link, fontSize: 14, fontWeight: "600" },
});
