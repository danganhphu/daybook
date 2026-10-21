// The first account, and break-glass when nobody can sign in; everything else is in the app's Settings.
//   pnpm access:account --username <name> --name "<display name>" --origin <app URL> --remote|--dry-run
//   pnpm access:setup-link --username <name> --origin <app URL> --remote|--dry-run
//   pnpm access:revoke --username <name> --remote|--dry-run
// A REST batch may not be atomic: an account left without its link gets one from access:setup-link.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

import type { Query } from "drizzle-orm";
import { z } from "zod";

import { databaseId } from "#cloudflare-config";
import { createOperatorConsole, type IssuedLink } from "@/composition/operator-console";
import { displayNameSchema, usernameSchema } from "@/features/access/domain/account";
import { vietnamTimeZone } from "@/shared/domain/vietnam-time-zone";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    username: { type: "string" },
    name: { type: "string" },
    origin: { type: "string" },
    remote: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

const command = z.enum(["account", "setup-link", "revoke"]).parse(positionals[0]);
if (values.remote === values["dry-run"]) {
  throw new Error("Choose one: --remote (writes to the production database) or --dry-run");
}
const username = usernameSchema.parse(values.username);
const operator = createOperatorConsole();

// cf prints the API's answer; take the rows of each statement whether or not they come wrapped in `result`
const d1Answer = z.union([
  z.object({ result: z.array(z.object({ results: z.array(z.unknown()) })) }),
  z.array(z.object({ results: z.array(z.unknown()) })),
]);

function query(statements: ReadonlyArray<Query>): unknown[][] {
  const directory = mkdtempSync(join(tmpdir(), "daybook-access-"));
  try {
    const file = join(directory, "batch.json");
    writeFileSync(file, JSON.stringify(statements.map(({ sql, params }) => ({ sql, params }))));
    // Whole command string: Windows starts pnpm's .cmd shim only through a shell
    const run = spawnSync(`pnpm exec cf d1 query ${databaseId} --batch "@${file}"`, {
      shell: true,
      encoding: "utf8",
    });
    if (run.status !== 0) {
      throw new Error(`cf d1 query failed:\n${run.stderr}${run.stdout}`);
    }

    const answer = d1Answer.parse(JSON.parse(run.stdout));
    return ("result" in answer ? answer.result : answer).map((statement) => statement.results);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function linkOrigin() {
  return z.url({ protocol: values.remote ? /^https$/ : /^https?$/ }).parse(values.origin);
}

function show(statements: ReadonlyArray<Query>) {
  console.log(JSON.stringify(statements, null, 2));
}

function printLink(issued: IssuedLink, displayName: string) {
  const expires = issued.link.expiresAt.toZonedDateTimeISO(vietnamTimeZone).toPlainTime();
  console.log(
    `Link cài đặt cho ${displayName}, dùng một lần, hết hạn lúc ${expires.toString({ smallestUnit: "minute" })}:`,
  );
  console.log(`${linkOrigin()}/setup#${issued.token}`);
}

async function existingAccount() {
  const lookup = operator.findAccount(username);
  if (values["dry-run"]) {
    show([lookup.query]);
    console.log("Dry run: the account is looked up first, then the statements are built for it.");
    return undefined;
  }

  const [rows] = query([lookup.query]);
  const found = lookup.read(rows);
  if (found === undefined) {
    throw new Error(`No account has the username ${username}`);
  }

  return found;
}

switch (command) {
  case "account": {
    const displayName = displayNameSchema.parse(values.name);
    const created = await operator.createAccount({ username, displayName });
    if (values["dry-run"]) {
      show(created.statements);
      break;
    }

    query(created.statements);
    printLink(created, displayName);
    break;
  }

  case "setup-link": {
    const found = await existingAccount();
    if (found === undefined) {
      break;
    }

    const recovery = await operator.issueRecoveryLink(found.id);
    query(recovery.statements);
    printLink(recovery, found.displayName);
    break;
  }

  case "revoke": {
    const found = await existingAccount();
    if (found === undefined) {
      break;
    }

    query((await operator.revokeSessions(found.id)).statements);
    console.log(`Đã đăng xuất ${found.displayName} trên mọi thiết bị.`);
    break;
  }
}
