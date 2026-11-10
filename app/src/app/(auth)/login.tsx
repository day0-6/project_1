import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { Question } from "@/components/Question";
import { Screen } from "@/components/Screen";
import { TextLink } from "@/components/TextLink";
import { copy } from "@/lib/copy";
import { supabase } from "@/lib/supabase";
import { colors, font, space } from "@/lib/theme";

type Mode = "login" | "signup";

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit = email.includes("@") && password.length >= 6;

  async function submit() {
    setBusy(true);
    setNotice(null);
    const credentials = { email: email.trim(), password };
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword(credentials);
      if (error) setNotice(copy.authFailed);
    } else {
      const { data, error } = await supabase.auth.signUp(credentials);
      if (error) setNotice(copy.authFailed);
      else if (!data.session) setNotice(copy.checkEmail); // 이메일 확인이 켜져 있으면 세션이 없다
    }
    setBusy(false);
  }

  return (
    <Screen>
      <View style={styles.body}>
        <Text style={styles.brand}>한 마디</Text>
        <Question>{mode === "login" ? copy.loginQuestion : copy.signUpQuestion}</Question>
        <View style={styles.form}>
          <Field
            value={email}
            onChangeText={setEmail}
            placeholder={copy.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            accessibilityLabel={copy.email}
          />
          <Field
            value={password}
            onChangeText={setPassword}
            placeholder={copy.password}
            secureTextEntry
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            accessibilityLabel={copy.password}
            onSubmitEditing={() => canSubmit && submit()}
          />
          {notice ? <Notice message={notice} /> : null}
          <Button label={mode === "login" ? copy.login : copy.signUp} onPress={submit} disabled={!canSubmit} loading={busy} />
          <View style={styles.switch}>
            <TextLink
              label={mode === "login" ? copy.toSignUp : copy.toLogin}
              onPress={() => {
                setMode(mode === "login" ? "signup" : "login");
                setNotice(null);
              }}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: "center" },
  brand: { fontSize: font.small, color: colors.accent, fontWeight: "700", marginBottom: space.sm, letterSpacing: 1 },
  form: { gap: space.sm + 4 },
  switch: { alignItems: "center", marginTop: space.sm },
});
