import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Loading } from "@/components/Centered";
import { AuthProvider, useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

function RootNavigator() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  const signedIn = session !== null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)/login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
