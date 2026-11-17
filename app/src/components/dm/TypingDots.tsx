import { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { dm } from "@/lib/dm";

/** 상대가 입력 중일 때 말풍선 안에서 통통 튀는 점 세 개 */
export function TypingDots() {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const useNativeDriver = Platform.OS !== "web";
    const loops = anims.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver }),
          Animated.timing(v, { toValue: 0, duration: 300, useNativeDriver }),
          Animated.delay((2 - i) * 150 + 200),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);

  return (
    <View style={styles.row} accessibilityLabel="입력 중">
      {anims.map((v, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 4, alignItems: "center", height: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: dm.meta },
});
