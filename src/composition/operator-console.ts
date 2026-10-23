import { eq, type Query } from "drizzle-orm";
import { z } from "zod";

import { issueSetupLink } from "@/features/access/application/issue-setup-link";
import { newAccount } from "@/features/access/application/new-account";
import type { Secrets } from "@/features/access/application/secrets";
import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import {
  displayNameSchema,
  type Account,
  type DisplayName,
  type Username,
} from "@/features/access/domain/account";
import type { SecretToken } from "@/features/access/domain/secret";
import { deviceLabelSchema } from "@/features/access/domain/session";
import type { PendingSetupLink } from "@/features/access/domain/setup-link";
import { accountTable } from "@/features/access/infrastructure/account.table";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import type { Clock } from "@/shared/application/clock";
import { accountIdSchema, type AccountId } from "@/shared/domain/account-id";
import type { Batch } from "@/shared/infrastructure/d1/batch";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import { systemClock } from "@/shared/infrastructure/system-clock";

import { createUnitOfWork } from "./unit-of-work";

// Drizzle needs a binding to build statements, never to show them; this one fails loudly if anything runs
const neverExecuted: D1Database = {
  prepare: () => unreachable(),
  batch: () => unreachable(),
  exec: () => unreachable(),
  withSession: () => unreachable(),
  dump: () => unreachable(),
};

function unreachable(): never {
  throw new Error("The operator console records statements; it never runs them");
}

const origin: RequestOrigin = {
  ip: undefined,
  deviceLabel: deviceLabelSchema.parse("Lệnh quản trị"),
};

export type Recorded<T> = T & { readonly statements: ReadonlyArray<Query> };

const foundAccountRows = z
  .array(z.object({ id: accountIdSchema, display_name: displayNameSchema }))
  .max(1);

export type FoundAccount = {
  readonly id: AccountId;
  readonly displayName: DisplayName;
};

export type IssuedLink = {
  readonly link: PendingSetupLink;
  readonly token: SecretToken;
};

// What the operator's command does, as D1 statements: the same use cases and writes the Worker runs, against a
// batch that records instead of executing. scripts/access.ts sends them to D1 with cf. For the two moments the app
// cannot help: the first account, and break-glass when nobody can sign in.
export function createOperatorConsole(
  clock: Clock = systemClock,
  secrets: Secrets = webCryptoSecrets,
) {
  const db = createDatabase(neverExecuted);

  function recorder() {
    const statements: Query[] = [];
    const batch: Batch = {
      enlist(statement) {
        statements.push(statement.toSQL());
      },
      async commit() {},
    };

    return { statements, startUnitOfWork: () => createUnitOfWork(db, batch) };
  }

  return {
    async createAccount(details: {
      readonly username: Username;
      readonly displayName: DisplayName;
    }): Promise<Recorded<IssuedLink & { readonly account: Account }>> {
      const { statements, startUnitOfWork } = recorder();
      const now = clock();
      const account = newAccount(secrets, details, now);

      const work = startUnitOfWork();
      work.accounts.add(account);
      work.accessEvents.add(
        AccessEvents.record("account_created", { accountId: account.id }, origin, now),
      );
      await work.commit();

      const issued = await issueSetupLink(
        { clock, secrets, startUnitOfWork },
        { purpose: "first_setup", accountId: account.id },
        origin,
      );

      return { ...issued, account, statements };
    },

    async issueRecoveryLink(accountId: AccountId): Promise<Recorded<IssuedLink>> {
      const { statements, startUnitOfWork } = recorder();
      const issued = await issueSetupLink(
        { clock, secrets, startUnitOfWork },
        { purpose: "recovery", accountId },
        origin,
      );

      return { ...issued, statements };
    },

    async revokeSessions(accountId: AccountId): Promise<Recorded<object>> {
      const { statements, startUnitOfWork } = recorder();
      const work = startUnitOfWork();
      work.sessions.removeAll(accountId);
      work.accessEvents.add(
        AccessEvents.record("sessions_revoked", { accountId }, origin, clock()),
      );
      await work.commit();

      return { statements };
    },

    // The lookup to run, and how to read the rows D1 sends back for it: raw rows, keyed by column name
    findAccount(username: Username) {
      return {
        query: db
          .select({ id: accountTable.id, displayName: accountTable.displayName })
          .from(accountTable)
          .where(eq(accountTable.username, username))
          .toSQL(),
        read(rows: unknown): FoundAccount | undefined {
          const [row] = foundAccountRows.parse(rows);

          return row === undefined ? undefined : { id: row.id, displayName: row.display_name };
        },
      };
    },
  };
}
