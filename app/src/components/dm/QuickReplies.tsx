import { Pressable, StyleSheet, Text, View } from "react-native";
import { dm } from "@/lib/dm";

/** AI가 준 단어 선택지 (최대 3개). 인스타 DM의 빠른 답장처럼 오른쪽 정렬 알약 버튼. */
export function QuickReplies({ choices, onPick, disabled }: { choices: string[]; onPick: (c: string) => void; disabled: boolean }) {
  if (choices.length === 0) return null;
  return (
    <View style={styles.row}>
      {choices.slice(0, 3).map((choice) => (
        <Pressable
          key={choice}
          accessibilityRole="button"
          onPress={() => onPick(choice)}
          disabled={disabled}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          <Text style={styles.label}>{choice}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, marginBottom: 10 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: dm.userBubble, paddingHorizontal: 14, paddingVertical: 7 },
  pressed: { backgroundColor: "#E8F3FE" },
  label: { color: dm.userBubble, fontSize: 15, fontWeight: "600" },
});
