import { router } from "expo-router";
import type { ReactElement } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { copy } from "@/lib/copy";
import { colors, font, space } from "@/lib/theme";
import { Button } from "./Button";
import { Loading } from "./Centered";
import { Notice } from "./Notice";
import { Question } from "./Question";
import { Screen } from "./Screen";

type Props<T> = {
  title: string;
  subtitle?: string;
  emptyMessage: string;
  state: { status: "loading" } | { status: "failed" } | { status: "ready"; data: T[] };
  onRetry: () => void;
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactElement;
};

/** 목록 화면 공통: 비어 있어도 빈 화면 대신 질문과 시작 버튼을 보여 준다 */
export function ListScreen<T>({ title, subtitle, emptyMessage, state, onRetry, keyOf, renderItem }: Props<T>) {
  return (
    <Screen>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {state.status === "loading" ? <Loading /> : null}
      {state.status === "failed" ? <Notice message={copy.loadFailed} actionLabel={copy.retry} onAction={onRetry} /> : null}
      {state.status === "ready" && state.data.length === 0 ? (
        <View style={styles.empty}>
          <Question>{emptyMessage}</Question>
          <Button label={copy.goStart} onPress={() => router.dismissTo("/")} />
        </View>
      ) : null}
      {state.status === "ready" && state.data.length > 0 ? (
        <FlatList
          data={state.data}
          keyExtractor={keyOf}
          renderItem={({ item }) => renderItem(item)}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          contentContainerStyle={styles.list}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.question, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: font.small, color: colors.subtle, marginTop: space.xs },
  empty: { flex: 1, justifyContent: "center" },
  list: { paddingVertical: space.md },
  gap: { height: space.sm },
});
