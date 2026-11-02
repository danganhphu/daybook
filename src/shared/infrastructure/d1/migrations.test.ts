import { applyD1Migrations, reset } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseTimeOfDay } from "@/features/notifications/domain/time-of-day";
import { paymentDetailsSchema } from "@/features/orders/domain/order";
import { productNameSchema } from "@/features/products/domain/product";
import { origin, seedAccount } from "@/testing/support/access";
import { changeOf, content, recordNote, testApp, testClock } from "@/testing/support/app";
import {
  browserSubscription,
  recordingPushSender,
  testJobs,
} from "@/testing/support/notifications";
import { aCustomer, aKind, anOrder, line } from "@/testing/support/orders";
import { seedPasskeyAccount } from "@/testing/support/passkeys";
import { seedPassword } from "@/testing/support/passwords";
import { aLine, anOrderReading, readerOf } from "@/testing/support/readings";
import { expectOk } from "@/testing/support/result";
import { lanOnTelegram, seedTelegramLink } from "@/testing/support/telegram";

// A migration runs on a book full of rows, but every other test starts from an empty one, where a rebuild that loses
// rows, or a check that old rows fail, passes unseen. Here a book is written with today's app, put back into the
// schema as it was before each of the newest migrations, and migrated again: every row must come through as it was.

const migrations = z
  .array(z.object({ name: z.string(), queries: z.array(z.string()) }))
  .parse(Reflect.get(env, "TEST_MIGRATIONS"));

// How many of the newest migrations are each tried against a book older than them
const newest = 3;

type Row = Readonly<Record<string, unknown>>;
type Table = { readonly name: string; readonly rows: ReadonlyArray<Row> };

// Monday 26 October, 09:00 in Vietnam
const monday = "2026-10-26T02:00:00Z";
const orderText = "bán 2 hộp thuốc tê cho nk Hướng Dương 500k";

// A little of everything a live book holds: people and their ways in, customers, products and their merges, orders
// with payments, a message read into an order, reminders, notifications delivered, a Telegram link
async function writeBook() {
  const time = testClock(monday);
  const app = testApp(
    time.clock,
    readerOf({ [orderText]: anOrderReading("nk Hướng Dương", [aLine("thuốc tê", 2, "500k")]) }),
  );
  const lan = await seedPasskeyAccount(time, "lan");
  await seedPassword(time, lan.account);
  const minh = await seedAccount(time.clock, "minh", "Minh");
  const by = lan.account.id;

  const kind = await aKind(app, "Nha khoa");
  const clinic = await aCustomer(app, "Nha khoa Hướng Dương", { kindId: kind.id });
  expectOk(
    await app.mergeCustomers({
      ...changeOf(await aCustomer(app, "chị Lan"), by),
      into: clinic.id,
    }),
  );
  const away = expectOk(await app.addProduct({ by, name: productNameSchema.parse("Gel tê") }));
  const kept = expectOk(await app.addProduct({ by, name: productNameSchema.parse("Gel gây tê") }));
  expectOk(await app.mergeProducts({ ...changeOf(away, by), into: kept.id }));

  const order = await anOrder(app, clinic, [line("Kim", 2, 100_000), line("Bông gòn", 1, 20_000)]);
  expectOk(
    await app.addPayment({
      ...changeOf(order, by),
      payment: paymentDetailsSchema.parse({
        amount: 50_000,
        paidOn: Temporal.PlainDate.from("2026-10-26"),
        method: "cash",
      }),
    }),
  );
  expectOk(await app.deleteOrder(changeOf(await anOrder(app, clinic, [line("Kim", 1, 1)]), by)));
  const note = await recordNote(app, orderText);
  expectOk(await app.readNote({ by, noteId: note.id, again: false }));
  expectOk(
    await app.addReminder({
      by,
      details: {
        text: content("Gọi lại"),
        dueOn: Temporal.PlainDate.from("2026-10-26"),
        customerId: clinic.id,
      },
      fromNote: undefined,
    }),
  );

  expectOk(await app.subscribeDevice(lan.session, browserSubscription(), origin()));
  const morningAt = parseTimeOfDay("07:00");
  if (!morningAt.ok) {
    throw new Error(morningAt.error);
  }
  expectOk(
    await app.changeNotificationTimes(lan.session, {
      times: { morningAt: morningAt.value, weeklyAt: undefined },
      shown: undefined,
    }),
  );
  const jobs = testJobs(time.clock, recordingPushSender().sender);
  await jobs.scheduleSlot(Temporal.Instant.from(monday));
  await jobs.deliver({ kind: "digest", digest: "morning", accountId: by, day: "2026-10-26" });

  await seedTelegramLink(time.clock, by, lanOnTelegram);
  expectOk(await app.startTelegramLink(lan.session));
  expectOk(await app.issueRecoveryLink(lan.session, minh.id, origin()));
  await app.redeemSetupLink("guess", origin());
}

async function tableNames(): Promise<string[]> {
  const { results } = await env.DB.prepare(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite\\_%' escape '\\' and name not like '\\_cf\\_%' escape '\\' and name <> 'd1_migrations' order by name",
  ).all<{ name: string }>();

  return results.map((table) => table.name);
}

async function dump(): Promise<Table[]> {
  return Promise.all(
    (await tableNames()).map(async (name) => ({
      name,
      rows: (await env.DB.prepare(`select * from "${name}"`).all<Row>()).results,
    })),
  );
}

async function columnsOf(table: string): Promise<ReadonlyArray<string>> {
  const { results } = await env.DB.prepare("select name from pragma_table_info(?)")
    .bind(table)
    .all<{ name: string }>();

  return results.map((column) => column.name);
}

// The book's rows, as far as the older schema has their tables and columns, in one batch with foreign keys checked at
// its end. Answers the tables and columns put back.
async function restore(
  book: ReadonlyArray<Table>,
): Promise<ReadonlyMap<string, ReadonlyArray<string>>> {
  const restored = new Map<string, ReadonlyArray<string>>();
  const statements = [env.DB.prepare("PRAGMA defer_foreign_keys = on")];
  for (const table of book) {
    // oxlint-disable-next-line no-await-in-loop -- a handful of tables, each read once
    const older = await columnsOf(table.name);
    if (older.length === 0) {
      continue;
    }
    restored.set(table.name, older);
    for (const row of table.rows) {
      const columns = older.filter((column) => column in row);
      statements.push(
        env.DB.prepare(
          `insert into "${table.name}" (${columns.map((column) => `"${column}"`).join(", ")}) values (${columns.map(() => "?").join(", ")})`,
        ).bind(...columns.map((column) => row[column])),
      );
    }
  }
  await env.DB.batch(statements);

  return restored;
}

// Each table's rows, in the columns given, in one order whatever the order they were read in
function project(
  book: ReadonlyArray<Table>,
  restored: ReadonlyMap<string, ReadonlyArray<string>>,
): Record<string, string[]> {
  return Object.fromEntries(
    book.flatMap((table) => {
      const columns = restored.get(table.name);
      return columns === undefined
        ? []
        : [
            [
              table.name,
              table.rows
                .map((row) => JSON.stringify(columns.map((column) => row[column])))
                .toSorted(),
            ],
          ];
    }),
  );
}

describe("migrating a book that has rows", () => {
  it.each(migrations.slice(-newest).map((migration) => migration.name))(
    "given a book from before %s, when it and every later migration run, then every row comes through as it was",
    async (name) => {
      await writeBook();
      const before = await dump();
      await reset();
      await applyD1Migrations(
        env.DB,
        migrations.slice(
          0,
          migrations.findIndex((migration) => migration.name === name),
        ),
      );

      const restored = await restore(before);
      await applyD1Migrations(env.DB, migrations);

      expect(project(await dump(), restored)).toEqual(project(before, restored));
      expect((await env.DB.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
    },
  );
});
