import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, space } from "@/lib/theme";

type Props = { children: ReactNode; padded?: boolean; background?: string };

export function Screen({ children, padded = true, background }: Props) {
  return (
    <SafeAreaView style={[styles.safe, background ? { backgroundColor: background } : null]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.flex, styles.inner, padded && styles.padded]}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  inner: { width: "100%", maxWidth: 560, alignSelf: "center" },
  padded: { paddingHorizontal: space.lg, paddingVertical: space.md },
});
