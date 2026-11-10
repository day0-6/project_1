import { StyleSheet, Text, View } from "react-native";
import { colors, font, radius, space } from "@/lib/theme";
import { TextLink } from "./TextLink";

/** 에러 대신 보여 주는 부드러운 안내. 빨간색/경고 아이콘을 쓰지 않는다. */
export function Notice({ message, actionLabel, onAction }: { message: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.box}>
      <Text style={styles.text}>{message}</Text>
      {actionLabel && onAction ? <TextLink label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.noticeSoft, borderRadius: radius.md, padding: space.md, gap: space.xs, marginVertical: space.sm },
  text: { color: colors.notice, fontSize: font.small, lineHeight: 20 },
});
