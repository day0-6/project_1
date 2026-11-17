import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { dm, type DmLine } from "@/lib/dm";
import { Avatar } from "./Avatar";

const BIG = 22;
const SMALL = 6;

/** 인스타 DM처럼 연달아 보낸 말풍선은 붙어 있고, 붙은 쪽 모서리만 작게 깎는다. */
export function DmBubble({ line }: { line: DmLine }) {
  const isAi = line.role === "ai";
  const corner = isAi
    ? { borderTopLeftRadius: line.first ? BIG : SMALL, borderBottomLeftRadius: line.last ? BIG : SMALL }
    : { borderTopRightRadius: line.first ? BIG : SMALL, borderBottomRightRadius: line.last ? BIG : SMALL };
  return (
    <View style={[styles.row, isAi ? styles.rowAi : styles.rowUser, line.last && styles.groupEnd]}>
      {isAi ? <View style={styles.avatarSlot}>{line.last ? <Avatar /> : null}</View> : null}
      <View style={[styles.bubble, isAi ? styles.ai : styles.user, corner]}>
        <Text lineBreakStrategyIOS="hangul-word" style={[styles.text, isAi ? styles.aiText : styles.userText]}>
          {line.text}
        </Text>
      </View>
    </View>
  );
}

export function TypingBubble({ children }: { children: ReactNode }) {
  return (
    <View style={[styles.row, styles.rowAi, styles.groupEnd]}>
      <View style={styles.avatarSlot}>
        <Avatar />
      </View>
      <View style={[styles.bubble, styles.ai, styles.typing]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", marginTop: 2 },
  rowAi: { justifyContent: "flex-start" },
  rowUser: { justifyContent: "flex-end" },
  groupEnd: { marginBottom: 10 },
  avatarSlot: { width: 28, marginRight: 8 },
  bubble: { maxWidth: "75%", borderRadius: BIG, paddingHorizontal: 14, paddingVertical: 9 },
  ai: { backgroundColor: dm.aiBubble },
  user: { backgroundColor: dm.userBubble },
  text: { fontSize: 16, lineHeight: 22 },
  aiText: { color: dm.aiText },
  userText: { color: dm.userText },
  typing: { paddingVertical: 14 },
});
