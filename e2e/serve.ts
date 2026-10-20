// Starts the production build for the end-to-end tests on a database of their own: emptied, migrated, then served.
// Run by Playwright's webServer, which passes DAYBOOK_DATABASE_ID and DAYBOOK_PERSIST_TO.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const databaseId = process.env["DAYBOOK_DATABASE_ID"];
const persistTo = process.env["DAYBOOK_PERSIST_TO"];
const port = process.env["DAYBOOK_E2E_PORT"];
if (databaseId === undefined || persistTo === undefined || port === undefined) {
  throw new Error("DAYBOOK_DATABASE_ID, DAYBOOK_PERSIST_TO and DAYBOOK_E2E_PORT must be set");
}

rmSync(persistTo, { recursive: true, force: true });

// Whole command strings: Windows starts pnpm's .cmd shim only through a shell, and Node deprecates args beside one
const migrate = spawnSync(
  `pnpm exec cf d1 migrations apply ${databaseId} --local --persist-to ${persistTo} --dir migrations --pattern "migrations/*/migration.sql"`,
  { stdio: "inherit", shell: true },
);
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const server = spawn(`pnpm exec vite preview --port ${port} --strictPort`, {
  stdio: "inherit",
  shell: true,
});
server.on("exit", (code) => process.exit(code ?? 0));
