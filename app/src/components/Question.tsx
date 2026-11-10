import { StyleSheet, Text } from "react-native";
import { colors, font, space } from "@/lib/theme";

/** 모든 화면의 시작점이 되는 질문 한 줄 */
export function Question({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={styles.text}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: font.question, lineHeight: 34, fontWeight: "600", color: colors.text, marginBottom: space.lg },
});
