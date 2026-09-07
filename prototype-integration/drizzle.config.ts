import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/integration/schema.ts",
  out: "./migrations",
});
