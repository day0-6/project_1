import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

type State<T> = { status: "loading" } | { status: "failed" } | { status: "ready"; data: T };

/** 화면에 들어올 때마다 다시 불러오는 간단한 조회 훅 */
export function useRemote<T>(fetcher: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({ status: "loading" });
  const reload = useCallback(() => {
    let active = true;
    fetcher()
      .then((data) => active && setState({ status: "ready", data }))
      .catch(() => active && setState({ status: "failed" }));
    return () => {
      active = false;
    };
  }, [fetcher]);
  useFocusEffect(reload);
  return { state, reload };
}
