import { Stack } from "expo-router";
import { colors } from "@/lib/theme";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.subtle,
        headerTitle: "",
        headerBackTitle: "뒤로",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
