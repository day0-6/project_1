/** EXPO_PUBLIC_* 값은 빌드에 포함되어 공개된다. 비밀 키를 여기 두지 않는다. */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name}이(가) 설정되지 않았어요. app/.env.example을 참고해 app/.env를 만들어 주세요.`);
  }
  return value;
}

export const config = {
  supabaseUrl: required("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, ""),
};
