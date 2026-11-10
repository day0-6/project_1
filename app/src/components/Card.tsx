import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, space } from "@/lib/theme";

type Props = { title: string; body?: string | null; meta?: string; onPress: () => void };

export function Card({ title, body, meta, onPress }: Props) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      {body ? <Text style={styles.body} numberOfLines={2}>{body}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.xs },
  pressed: { backgroundColor: colors.accentSoft },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.sm },
  title: { fontSize: font.body + 1, fontWeight: "700", color: colors.text, flexShrink: 1 },
  meta: { fontSize: font.small - 1, color: colors.faint },
  body: { fontSize: font.small, color: colors.subtle, lineHeight: 20 },
});
