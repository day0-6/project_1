import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, font, radius, space } from "@/lib/theme";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "quiet";
};

export function Button({ label, onPress, disabled = false, loading = false, variant = "primary" }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" ? styles.primary : styles.quiet,
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.surface : colors.accent} />
      ) : (
        <Text style={[styles.label, variant === "primary" ? styles.primaryLabel : styles.quietLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
  primary: { backgroundColor: colors.accent },
  quiet: { backgroundColor: colors.accentSoft },
  inactive: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  label: { fontSize: font.body, fontWeight: "600" },
  primaryLabel: { color: colors.surface },
  quietLabel: { color: colors.accent },
});
