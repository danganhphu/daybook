// What the end-to-end database starts with, made fresh for every run: real rows, random secrets, nothing committed.
// The SQL goes in through cf's own migration command, the same way the schema does. Secrets are made with the app's
// own code, so a seeded password is checked exactly as one set in the app.
import { createHash, randomBytes } from "node:crypto";

import { Temporal } from "temporal-polyfill/implementation";
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
import * as Customers from "@/features/customers/domain/customer";
import { customerDetailsSchema } from "@/features/customers/domain/customer";
import * as CustomerKinds from "@/features/customers/domain/customer-kind";
import { kindNameSchema, positionSchema } from "@/features/customers/domain/customer-kind";
import { toCustomerKindRow } from "@/features/customers/infrastructure/customer-kind-mapping";
import { toCustomerRow } from "@/features/customers/infrastructure/customer-mapping";
import * as Orders from "@/features/orders/domain/order";
import { orderDetailsSchema } from "@/features/orders/domain/order";
import * as OrderChanges from "@/features/orders/domain/order-change";
import { toLineRows, toOrderRow } from "@/features/orders/infrastructure/order-mapping";
import * as Products from "@/features/products/domain/product";
import { productNameSchema } from "@/features/products/domain/product";
import { toProductRow } from "@/features/products/infrastructure/product-mapping";
import { accountIdSchema } from "@/shared/domain/account-id";
import { searchText } from "@/shared/domain/search-text";
import { vietnamDate } from "@/shared/domain/vietnam-day";
import { vietnamTimeZone } from "@/shared/domain/vietnam-time-zone";

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

// Written yesterday at noon, Vietnam time: what the history scenarios look back at. Scenarios only read it, so it
// holds for every project in the run.
export const yesterdaysNote = "Hẹn giao kim tiêm cho nha khoa Hướng Dương";

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

// A note typed on the web, as recording one stores it: the capture with the words as sent, and the note filed from it
function note(authorId: string, content: string, at: number): string {
  const captureId = uuidv7();

  return [
    insert("capture", {
      id: captureId,
      content,
      source: "web",
      author_id: authorId,
      received_at: at,
    }),
    insert("note", {
      id: uuidv7(),
      capture_id: captureId,
      content,
      search_text: searchText(content),
      created_at: at,
      created_by: authorId,
      updated_at: at,
      updated_by: authorId,
      version: 1,
      deleted_at: null,
      deleted_by: null,
    }),
  ].join(statementBreak);
}

// A row as the app maps it, with its columns named as in the table: searchName is search_name
function columns(row: Readonly<Record<string, string | number | null>>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      value,
    ]),
  );
}

// What the customer and order scenarios start from, made with the app's own domain code and mappings so it is stored
// exactly as the app stores it. Names are invented.
export const book = {
  clinic: "Nha khoa",
  agent: "Đại lý",
  sunflower: "Hướng Dương",
  morningStar: "Sao Mai",
  needles: "Kim nha khoa",
} as const;

function seededBook(accountId: string, now: number): string {
  const by = accountIdSchema.parse(accountId);
  const at = Temporal.Instant.fromEpochMilliseconds(now);
  const clinic = CustomerKinds.create(
    kindNameSchema.parse(book.clinic),
    positionSchema.parse(0),
    by,
    at,
  );
  const agent = CustomerKinds.create(
    kindNameSchema.parse(book.agent),
    positionSchema.parse(1),
    by,
    at,
  );
  const sunflower = Customers.create(
    customerDetailsSchema.parse({ name: book.sunflower, kindId: clinic.id, area: "Quận 3" }),
    by,
    at,
  );
  const morningStar = Customers.create(
    customerDetailsSchema.parse({ name: book.morningStar, kindId: agent.id, area: "Thủ Đức" }),
    by,
    at,
  );
  const needles = Products.create(productNameSchema.parse(book.needles), by, at);
  const yesterday = vietnamDate(at).subtract({ days: 1 });
  const order = Orders.place(
    orderDetailsSchema.parse({
      customerId: sunflower.id,
      orderedOn: yesterday,
      lines: [{ productId: needles.id, quantity: 2, unitPrice: 400_000 }],
    }),
    by,
    at,
  );
  if (!order.ok) {
    throw new Error(`The seeded order was refused: ${order.error}`);
  }
  const placed = OrderChanges.record("placed", undefined, order.value);

  return [
    insert("customer_kind", columns(toCustomerKindRow(clinic))),
    insert("customer_kind", columns(toCustomerKindRow(agent))),
    insert("customer", columns(toCustomerRow(sunflower))),
    insert("customer", columns(toCustomerRow(morningStar))),
    insert("product", columns(toProductRow(needles))),
    insert("sales_order", columns(toOrderRow(order.value))),
    ...toLineRows(order.value).map((line) => insert("order_line", columns(line))),
    insert("order_change", {
      id: placed.id,
      order_id: placed.orderId,
      kind: placed.kind,
      changed_at: placed.at.epochMilliseconds,
      changed_by: placed.by,
      before: null,
      after: JSON.stringify(placed.after),
    }),
  ].join(statementBreak);
}

function yesterdayNoon(now: number): number {
  return vietnamDate(Temporal.Instant.fromEpochMilliseconds(now))
    .subtract({ days: 1 })
    .toZonedDateTime({ timeZone: vietnamTimeZone, plainTime: "12:00" }).epochMilliseconds;
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
    note(lan, yesterdaysNote, yesterdayNoon(now)),
    seededBook(lan, now),
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
