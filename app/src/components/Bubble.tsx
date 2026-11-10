import { StyleSheet, Text, View } from "react-native";
import { colors, font, radius, space } from "@/lib/theme";

export function Bubble({ role, content }: { role: "ai" | "user"; content: string }) {
  const isAi = role === "ai";
  return (
    <View style={[styles.bubble, isAi ? styles.ai : styles.user]}>
      <Text style={[styles.text, isAi && styles.aiText]}>{content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "85%", borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm + 2, marginVertical: space.xs },
  ai: { alignSelf: "flex-start", backgroundColor: colors.aiBubble, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 6 },
  user: { alignSelf: "flex-end", backgroundColor: colors.userBubble, borderBottomRightRadius: 6 },
  text: { fontSize: font.body, lineHeight: 25, color: colors.text },
  aiText: { fontWeight: "500" },
});
