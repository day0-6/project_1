import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { dm } from "@/lib/dm";
import { Avatar } from "./Avatar";

export function DmHeader({ subtitle }: { subtitle: string }) {
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <View style={styles.bar}>
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={12} style={styles.back}>
        <Text style={styles.chevron}>‹</Text>
      </Pressable>
      <Avatar size={34} />
      <View style={styles.names}>
        <Text style={styles.name}>한 마디</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dm.border },
  back: { paddingRight: 4 },
  chevron: { fontSize: 34, lineHeight: 34, color: dm.aiText, marginTop: -4 },
  names: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700", color: dm.aiText },
  sub: { fontSize: 12, color: dm.meta },
});
