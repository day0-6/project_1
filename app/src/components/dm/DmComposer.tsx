import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { copy } from "@/lib/copy";
import { dm } from "@/lib/dm";
import { handleEnterToSend } from "@/lib/enterToSend";

type Props = { value: string; onChange: (t: string) => void; onSend: () => void; disabled: boolean };

/** 인스타 DM 입력창: 둥근 칸, 글을 쓰면 오른쪽에 '보내기'가 나타난다. Enter로 보낸다. */
export function DmComposer({ value, onChange, onSend, disabled }: Props) {
  const canSend = value.trim().length > 0 && !disabled;
  return (
    <View style={styles.pill}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={copy.answerPlaceholder}
        placeholderTextColor={dm.meta}
        accessibilityLabel={copy.answerPlaceholder}
        maxLength={2000}
        multiline
        rows={1}
        style={styles.input}
        submitBehavior="submit"
        returnKeyType="send"
        onSubmitEditing={onSend}
        onKeyPress={Platform.OS === "web" ? (e) => handleEnterToSend(e, onSend) : undefined}
      />
      {value.trim().length > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel={copy.send} onPress={onSend} disabled={!canSend} hitSlop={8}>
          <Text style={[styles.send, !canSend && styles.sendOff]}>{copy.send}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "flex-end", borderWidth: 1, borderColor: dm.border, borderRadius: 24, paddingLeft: 16, paddingRight: 14, minHeight: 46 },
  input: { flex: 1, minWidth: 0, maxHeight: 120, fontSize: 16, lineHeight: 22, color: dm.aiText, paddingVertical: 12, outlineWidth: 0, outlineColor: "transparent", backgroundColor: "transparent" },
  send: { color: dm.link, fontSize: 16, fontWeight: "700", paddingVertical: 12, paddingLeft: 8 },
  sendOff: { opacity: 0.4 },
});
