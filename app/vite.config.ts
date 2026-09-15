import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwind(), solid()],
  publicDir: false,
  build: { outDir: "public", target: "esnext" },
  server: { host: "127.0.0.1" },
});
