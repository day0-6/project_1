import type { TextInputKeyPressEvent } from "react-native";

type WebKeyEvent = { shiftKey?: boolean; isComposing?: boolean; keyCode?: number };

/**
 * 웹에서 Enter는 보내기, Shift+Enter는 줄바꿈.
 * 한글 입력 중(조합 중) Enter는 글자를 확정하는 것이므로 보내지 않는다.
 * true를 돌려주면 보내기로 처리했다는 뜻이다.
 */
export function handleEnterToSend(e: TextInputKeyPressEvent, send: () => void): boolean {
  if (e.nativeEvent.key !== "Enter") return false;
  const native: TextInputKeyPressEvent["nativeEvent"] & WebKeyEvent = e.nativeEvent;
  if (native.shiftKey || native.isComposing || native.keyCode === 229) return false;
  e.preventDefault();
  send();
  return true;
}
