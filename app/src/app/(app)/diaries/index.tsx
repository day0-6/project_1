import { router } from "expo-router";
import { useCallback } from "react";
import { Card } from "@/components/Card";
import { ListScreen } from "@/components/ListScreen";
import { api } from "@/lib/api";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/format";
import { useRemote } from "@/lib/useRemote";

export default function DiariesScreen() {
  const fetcher = useCallback(async () => (await api.listDiaries()).diaries, []);
  const { state, reload } = useRemote(fetcher);
  return (
    <ListScreen
      title={copy.diariesTitle}
      emptyMessage={copy.diariesEmpty}
      state={state}
      onRetry={reload}
      keyOf={(d) => d.id}
      renderItem={(d) => (
        <Card
          title={d.seed_word}
          body={d.content}
          meta={formatDate(d.created_at)}
          onPress={() => router.push({ pathname: "/diaries/[id]", params: { id: d.id } })}
        />
      )}
    />
  );
}
