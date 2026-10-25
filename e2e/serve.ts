// Starts the end-to-end build (`pnpm build:e2e`) on a database of their own: emptied, migrated, seeded, then served
// over HTTPS. Run by Playwright's webServer, which passes the variables checked below.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

import { Temporal } from "temporal-polyfill/implementation";

import { pepperByteLength } from "@/features/access/domain/access-policy";
import { vietnamDate } from "@/shared/domain/vietnam-day";

import { fixturesFile, persistTo, seedMigrations } from "./paths.ts";
import { readingsFor } from "./readings.ts";
import { seed } from "./seed.ts";

const databaseId = process.env["DAYBOOK_DATABASE_ID"];
const port = process.env["DAYBOOK_E2E_PORT"];
if (databaseId === undefined || port === undefined || process.env["APP_ORIGIN"] === undefined) {
  throw new Error("DAYBOOK_DATABASE_ID, DAYBOOK_E2E_PORT and APP_ORIGIN must be set");
}

// The production build reads its pepper from the PASSWORD_PEPPER secret; for this run, a random one, which the seed
// uses for Lan's password too
const pepper = randomBytes(pepperByteLength).toString("base64url");

rmSync(persistTo, { recursive: true, force: true });

// Whole command strings: Windows starts pnpm's .cmd shim only through a shell, and Node deprecates args beside one
function applyMigrations(dir: string) {
  const applied = spawnSync(
    `pnpm exec cf d1 migrations apply ${databaseId} --local --persist-to ${persistTo} --dir ${dir} --pattern "${dir}/*/migration.sql"`,
    { stdio: "inherit", shell: true },
  );
  if (applied.status !== 0) {
    process.exit(applied.status ?? 1);
  }
}

applyMigrations("migrations");

const seeded = await seed(pepper);
mkdirSync(`${seedMigrations}/0001_e2e_seed`, { recursive: true });
writeFileSync(`${seedMigrations}/0001_e2e_seed/migration.sql`, seeded.sql);
applyMigrations(seedMigrations);
writeFileSync(fixturesFile, JSON.stringify(seeded.fixtures));

const server = spawn(`pnpm exec vite preview --port ${port} --strictPort`, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DAYBOOK_PERSIST_TO: persistTo,
    DAYBOOK_HTTPS: "1",
    PASSWORD_PEPPER: pepper,
    REPLAY_READINGS: JSON.stringify(readingsFor(vietnamDate(Temporal.Now.instant()))),
  },
});
server.on("exit", (code) => process.exit(code ?? 0));
