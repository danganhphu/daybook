import { defineConfig } from "drizzle-kit";

// drizzle-kit only generates SQL here; `pnpm db:migrate` applies it with cf
export default defineConfig({
  dialect: "sqlite",
  schema: "./core/infrastructure/d1/*.table.ts",
  out: "./migrations",
});
