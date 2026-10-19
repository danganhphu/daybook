import { defineConfig } from "drizzle-kit";

// drizzle-kit only generates SQL here; `pnpm db:migrate` applies it with cf
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/features/*/infrastructure/*.table.ts",
  out: "./migrations",
});
