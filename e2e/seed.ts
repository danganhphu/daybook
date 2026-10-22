// What the end-to-end database starts with, made fresh for every run: real rows, random secrets, nothing committed.
// The SQL goes in through cf's own migration command, the same way the schema does. Secrets are made with the app's
// own code, so a seeded password is checked exactly as one set in the app.
import { createHash, randomBytes } from "node:crypto";

import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";

import { verifierFor } from "@/features/access/application/password-keys";
import {
  passwordSaltByteLength,
  secretByteLength,
  sessionLifetime,
  setupLinkLifetime,
  stepUpWindow,
} from "@/features/access/domain/access-policy";
import { currentArgon2Parameters, derivedKeySchema } from "@/features/access/domain/password";
import { peppersFrom } from "@/features/access/infrastructure/pepper-keys";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import { deriveKey, normalizePassword } from "@/features/access/web/browser-password";

// What the steps need to know about the rows
export type Fixtures = {
  // Lan's session, signed in just now
  readonly sessionCookie: string;
  // More of Lan's sessions, signed in long enough ago that security settings ask her to confirm again. Confirming
  // replaces the session, so each scenario run takes one of its own.
  readonly staleSessionCookies: ReadonlyArray<string>;
  // Lan's fallback password, which is how she confirms: she has no passkey
  readonly lanPassword: string;
  // Setup links for Minh, who has no way in yet
  readonly setupTokens: ReadonlyArray<string>;
};

// Between statements of a migration file, as drizzle-kit writes them and cf splits them
const statementBreak = ";\n--> statement-breakpoint\n";

// One per scenario that spends one, per project, with room for CI's retry
const setupLinkCount = 16;
const staleSessionCount = 8;

function milliseconds(duration: Temporal.Duration): number {
  return duration.total("milliseconds");
}

function randomValue(byteLength = secretByteLength): string {
  return randomBytes(byteLength).toString("base64url");
}

// As the app stores secrets: the SHA-256 of the raw bytes, base64url
function sha256(value: string): string {
  return createHash("sha256").update(Buffer.from(value, "base64url")).digest("base64url");
}

function quote(value: string | number | null): string {
  if (value === null) {
    return "null";
  }

  return typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
}

function insert(table: string, row: Readonly<Record<string, string | number | null>>): string {
  return `insert into ${table} (${Object.keys(row).join(", ")}) values (${Object.values(row).map(quote).join(", ")})`;
}

const deviceLabel = "Playwright";

// A session and the sign-in that opened it, as the app would have logged it
function session(accountId: string, authenticatedAt: number, now: number) {
  const id = uuidv7();
  const secret = randomValue();

  return {
    cookie: `${id}.${secret}`,
    sql: [
      insert("session", {
        id,
        account_id: accountId,
        verifier: sha256(secret),
        method: "passkey",
        passkey_id: null,
        authenticated_at: authenticatedAt,
        expires_at: authenticatedAt + milliseconds(sessionLifetime),
        last_seen_at: now,
        device_label: deviceLabel,
      }),
      insert("access_event", {
        id: uuidv7(),
        occurred_at: authenticatedAt,
        kind: "session_opened",
        account_id: accountId,
        actor_id: accountId,
        session_id: id,
        passkey_id: null,
        ip: null,
        device_label: deviceLabel,
        detail: JSON.stringify({ method: "passkey" }),
      }),
    ].join(statementBreak),
  };
}

// The password as the browser would turn it into a key, and the server into a verifier
async function password(accountId: string, text: string, pepper: string, now: number) {
  const salt = randomValue(passwordSaltByteLength);
  const key = derivedKeySchema.parse(
    await deriveKey(normalizePassword(text), salt, currentArgon2Parameters),
  );
  const { current } = peppersFrom(pepper);

  return insert("password", {
    account_id: accountId,
    salt,
    argon2_memory_kib: currentArgon2Parameters.memoryKib,
    argon2_iterations: currentArgon2Parameters.iterations,
    argon2_parallelism: currentArgon2Parameters.parallelism,
    verifier: await verifierFor(webCryptoSecrets, current, key),
    pepper_version: current.version,
    consecutive_failures: 0,
    locked_at: null,
    changed_at: now,
  });
}

export async function seed(
  pepper: string,
  now: number = Date.now(),
): Promise<{ readonly sql: string; readonly fixtures: Fixtures }> {
  const lan = uuidv7();
  const minh = uuidv7();
  const lanPassword = randomValue(18);
  const setupTokens = Array.from({ length: setupLinkCount }, () => randomValue());
  const fresh = session(lan, now, now);
  const longAgo = now - 2 * milliseconds(stepUpWindow);
  const stale = Array.from({ length: staleSessionCount }, () => session(lan, longAgo, now));

  const people = [
    { id: lan, username: "lan", name: "Lan" },
    { id: minh, username: "minh", name: "Minh" },
  ];

  const statements = [
    ...people.map((person) =>
      insert("account", {
        id: person.id,
        username: person.username,
        display_name: person.name,
        webauthn_user_handle: randomValue(),
        created_at: now,
        updated_at: now,
      }),
    ),
    fresh.sql,
    ...stale.map(({ sql }) => sql),
    await password(lan, lanPassword, pepper, now),
    ...setupTokens.map((token) =>
      insert("setup_link", {
        id: uuidv7(),
        purpose: "first_setup",
        account_id: minh,
        created_by: null,
        token_hash: sha256(token),
        created_at: now,
        expires_at: now + milliseconds(setupLinkLifetime),
        redeemed_at: null,
      }),
    ),
  ];

  return {
    sql: `${statements.join(statementBreak)};\n`,
    fixtures: {
      sessionCookie: fresh.cookie,
      staleSessionCookies: stale.map(({ cookie }) => cookie),
      lanPassword,
      setupTokens,
    },
  };
}
