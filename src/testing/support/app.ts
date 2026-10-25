import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";

import { createApp } from "@/composition/create-app";
import { createUnitOfWork } from "@/composition/unit-of-work";
import { newAccount } from "@/features/access/application/new-account";
import { displayNameSchema, usernameSchema } from "@/features/access/domain/account";
import { createAccountRepository } from "@/features/access/infrastructure/account-repository";
import { peppersFrom } from "@/features/access/infrastructure/pepper-keys";
import type { RelyingParty } from "@/features/access/infrastructure/simple-webauthn-verifier";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import type { MessageReader } from "@/features/reading/application/message-reader";
import type { Clock } from "@/shared/application/clock";
import type { RecordChange } from "@/shared/application/record-change";
import { accountIdSchema, type AccountId } from "@/shared/domain/account-id";
import type { Audit } from "@/shared/domain/audit";
import { contentSchema, type Content } from "@/shared/domain/content";
import { createDatabase } from "@/shared/infrastructure/d1/database";

// A clock the test moves by hand
export function testClock(start: string) {
  let now = Temporal.Instant.from(start);
  const clock: Clock = () => now;

  return {
    clock,
    setTo(iso: string) {
      now = Temporal.Instant.from(iso);
    },
  };
}

// A made-up workers.dev host: the shape of the real one, which is never written into the repository
export const relyingParty: RelyingParty = {
  id: "daybook.example.workers.dev",
  origin: "https://daybook.example.workers.dev",
  name: "daybook",
};

// The real application over the test's D1, which tests/setup/d1.ts empties and migrates before every test
// A fixed pepper, so tests can compute verifiers; never the production one
export const testPeppers = peppersFrom("dGVzdC1wZXBwZXItZm9yLWRheWJvb2stdGVzdHMtb2s");

// A reader stands in for the model where a test reads notes; none, and notes stay notes
export function testApp(clock: Clock, reader?: MessageReader) {
  return createApp({ db: env.DB, relyingParty, peppers: testPeppers, reader }, clock);
}

export function content(text: string): Content {
  return contentSchema.parse(text);
}

// A note typed into the web app now, by the test's author
export async function recordNote(app: ReturnType<typeof testApp>, text: string) {
  return app.recordCapture({ content: content(text), source: "web", authorId: await theAuthor() });
}

// A change to a record as a screen showing it now would send it
export function changeOf<Id>(
  record: { readonly id: Id; readonly audit: Audit },
  by: AccountId,
): RecordChange<Id> {
  return { id: record.id, by, shown: record.audit.version };
}

// An author for tests that never store the capture, so no account has to exist
export const anAuthorId = accountIdSchema.parse("019a0000-0000-7000-8000-0000000000a1");

// Whoever typed, for tests that are not about who: one account in each test's fresh database, made on first use
export function theAuthor(): Promise<AccountId> {
  return accountNamed("author", "Người ghi");
}

// The other person sharing the book, for tests about who changed what
export function thePartner(): Promise<AccountId> {
  return accountNamed("partner", "Người cùng ghi");
}

async function accountNamed(name: string, displayName: string): Promise<AccountId> {
  const db = createDatabase(env.DB);
  const username = usernameSchema.parse(name);
  const existing = await createAccountRepository(db).findByUsername(username);
  if (existing !== undefined) {
    return existing.id;
  }

  const account = newAccount(
    webCryptoSecrets,
    { username, displayName: displayNameSchema.parse(displayName) },
    Temporal.Instant.from("2026-10-01T00:00:00Z"),
  );
  const work = createUnitOfWork(db);
  work.accounts.add(account);
  await work.commit();

  return account.id;
}
