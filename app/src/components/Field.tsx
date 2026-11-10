import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { colors, font, radius, space } from "@/lib/theme";

export function Field({ style, ...props }: TextInputProps) {
  return <TextInput placeholderTextColor={colors.faint} style={[styles.input, style]} {...props} />;
}

const styles = StyleSheet.create({
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: font.body,
    color: colors.text,
  },
});
