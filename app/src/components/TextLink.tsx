import { Pressable, StyleSheet, Text } from "react-native";
import { colors, font, space } from "@/lib/theme";

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={styles.hit}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { paddingVertical: space.xs },
  text: { fontSize: font.small, color: colors.subtle, textDecorationLine: "underline" },
});
