import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";

import { createApp } from "@/composition/create-app";
import { createUnitOfWork } from "@/composition/unit-of-work";
import { newAccount } from "@/features/access/application/new-account";
import {
  accountIdSchema,
  displayNameSchema,
  usernameSchema,
  type AccountId,
} from "@/features/access/domain/account";
import { createAccountRepository } from "@/features/access/infrastructure/account-repository";
import { peppersFrom } from "@/features/access/infrastructure/pepper-keys";
import type { RelyingParty } from "@/features/access/infrastructure/simple-webauthn-verifier";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import type { Clock } from "@/shared/application/clock";
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

export function testApp(clock: Clock) {
  return createApp({ db: env.DB, relyingParty, peppers: testPeppers }, clock);
}

export function content(text: string): Content {
  return contentSchema.parse(text);
}

// An author for tests that never store the capture, so no account has to exist
export const anAuthorId = accountIdSchema.parse("019a0000-0000-7000-8000-0000000000a1");

// Whoever typed, for tests that are not about who: one account in each test's fresh database, made on first use
export async function theAuthor(): Promise<AccountId> {
  const db = createDatabase(env.DB);
  const username = usernameSchema.parse("author");
  const existing = await createAccountRepository(db).findByUsername(username);
  if (existing !== undefined) {
    return existing.id;
  }

  const account = newAccount(
    webCryptoSecrets,
    { username, displayName: displayNameSchema.parse("Người ghi") },
    Temporal.Instant.from("2026-10-01T00:00:00Z"),
  );
  const work = createUnitOfWork(db);
  work.accounts.add(account);
  await work.commit();

  return account.id;
}
