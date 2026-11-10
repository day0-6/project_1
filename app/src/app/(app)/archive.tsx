import { router } from "expo-router";
import { useCallback } from "react";
import { Card } from "@/components/Card";
import { ListScreen } from "@/components/ListScreen";
import { api } from "@/lib/api";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/format";
import { useRemote } from "@/lib/useRemote";

export default function ArchiveScreen() {
  const fetcher = useCallback(async () => (await api.listSessions("in_progress")).sessions, []);
  const { state, reload } = useRemote(fetcher);
  return (
    <ListScreen
      title={copy.archiveTitle}
      subtitle={copy.archiveSubtitle}
      emptyMessage={copy.archiveEmpty}
      state={state}
      onRetry={reload}
      keyOf={(s) => s.id}
      renderItem={(s) => (
        <Card
          title={s.seed_word}
          body={s.last_answer}
          meta={`${formatDate(s.updated_at)} · ${copy.answers(s.answer_count)}`}
          onPress={() => router.push({ pathname: "/chat/[id]", params: { id: s.id } })}
        />
      )}
    />
  );
}
