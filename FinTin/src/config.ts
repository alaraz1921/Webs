/** Accept only browser-safe Supabase keys; never include a secret in a Vite bundle. */
export function publicKey(value: string) {
  if (value.startsWith("sb_secret_")) return false;
  try {
    if (value.split(".").length === 3)
      return (
        JSON.parse(
          atob(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        ).role === "anon"
      );
  } catch {
    return false;
  }
  return value.startsWith("sb_publishable_");
}
export function validUrl(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" ||
      (u.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(u.hostname))
    );
  } catch {
    return false;
  }
}
