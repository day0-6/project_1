import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, space } from "@/lib/theme";

/** AI가 준 단어 선택지 (최대 3개). 누르면 그 단어로 답한다. */
export function ChoiceChips({ choices, onPick, disabled }: { choices: string[]; onPick: (c: string) => void; disabled?: boolean }) {
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
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.sm },
  chip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.accent, paddingHorizontal: space.md, paddingVertical: space.sm },
  pressed: { backgroundColor: colors.accentSoft },
  label: { color: colors.accent, fontSize: font.small, fontWeight: "600" },
});
