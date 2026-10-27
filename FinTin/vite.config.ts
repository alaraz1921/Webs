import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { publicKey, validUrl } from "./src/config";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const keys = [
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    env.VITE_SUPABASE_ANON_KEY,
  ].filter(Boolean);
  if (
    keys.some((k) => !publicKey(k)) ||
    ((env.VITE_SUPABASE_URL || keys.length) &&
      (!validUrl(env.VITE_SUPABASE_URL) || !keys.length))
  )
    throw new Error(
      "Configura una URL válida y exclusivamente claves públicas Supabase. No se compilará una clave secreta.",
    );
  return {
    root: "src",
    envDir: "..",
    plugins: [react()],
    base: env.VITE_BASE_PATH || "/FinTin/",
    build: {
      outDir: "../dist",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            supabase: ["@supabase/supabase-js"],
          },
        },
      },
    },
  };
});
