import { StyleSheet, Text, View } from "react-native";
import { dm } from "@/lib/dm";

export function Avatar({ size = 28 }: { size?: number }) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.letter, { fontSize: size * 0.45 }]}>한</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: dm.avatar, alignItems: "center", justifyContent: "center" },
  letter: { color: dm.avatarText, fontWeight: "700" },
});
