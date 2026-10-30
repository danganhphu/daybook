import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import type { App } from "@/composition/create-app";
import { createUnitOfWork } from "@/composition/unit-of-work";
import type { CustomerId } from "@/features/customers/domain/customer";
import type { CustomerKindId } from "@/features/customers/domain/customer-kind";
import type { NoteId } from "@/features/notes/domain/note";
import { paymentDetailsSchema, type OrderId } from "@/features/orders/domain/order";
import { productNameSchema, type ProductId } from "@/features/products/domain/product";
import type { ReminderId } from "@/features/reminders/domain/reminder";
import type { TrashItem } from "@/features/trash/domain/trash";
import type { Audit } from "@/shared/domain/audit";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import {
  changeOf,
  content,
  recordNote,
  testApp,
  testClock,
  theAuthor,
} from "@/testing/support/app";
import { aCustomer, aKind, anOrder, line } from "@/testing/support/orders";
import { expectOk } from "@/testing/support/result";

import { emptyExpiredTrash } from "./purge-from-trash";

const monday = "2026-10-26T02:00:00Z";

function anApp() {
  return testApp(testClock(monday).clock);
}

async function aReminder(app: App, text: string, customerId: CustomerId | undefined) {
  return expectOk(
    await app.addReminder({
      by: await theAuthor(),
      details: { text: content(text), dueOn: Temporal.PlainDate.from("2026-10-27"), customerId },
      fromNote: undefined,
    }),
  );
}

async function rows(table: string, where = "1 = 1", ...values: ReadonlyArray<string>) {
  const found = await env.DB.prepare(`select count(*) as count from ${table} where ${where}`)
    .bind(...values)
    .first<{ count: number }>();

  return found?.count ?? 0;
}

type Shown<Id> = { readonly id: Id; readonly audit: Audit };

// Each kind of thing as the trash screen would send it, at the version it showed
const trashed = {
  order: ({ id, audit }: Shown<OrderId>): TrashItem => ({
    kind: "order",
    id,
    shown: audit.version,
  }),
  note: ({ id, audit }: Shown<NoteId>): TrashItem => ({ kind: "note", id, shown: audit.version }),
  reminder: ({ id, audit }: Shown<ReminderId>): TrashItem => ({
    kind: "reminder",
    id,
    shown: audit.version,
  }),
  customer: ({ id, audit }: Shown<CustomerId>): TrashItem => ({
    kind: "customer",
    id,
    shown: audit.version,
  }),
  product: ({ id, audit }: Shown<ProductId>): TrashItem => ({
    kind: "product",
    id,
    shown: audit.version,
  }),
  kind: ({ id, audit }: Shown<CustomerKindId>): TrashItem => ({
    kind: "kind",
    id,
    shown: audit.version,
  }),
};

// How many rows each table holds, read side by side
function rowsIn(tables: ReadonlyArray<string>) {
  return Promise.all(tables.map((table) => rows(table)));
}

describe("deleting a customer", () => {
  it("given a customer with orders and reminders, when deleted, then the live ones go with them and an order deleted before stays on its own", async () => {
    const app = anApp();
    const by = await theAuthor();
    const lan = await aCustomer(app, "Nha khoa Lan Anh");
    const live = await anOrder(app, lan, [line("Kim", 2, 100_000)]);
    const before = await anOrder(app, lan, [line("Bông gòn", 1, 20_000)]);
    expectOk(await app.deleteOrder(changeOf(before, by)));
    const reminder = await aReminder(app, "Gọi lại", lan.id);

    expect(await app.customerDeletePreview(lan.id)).toEqual({ orders: 1, reminders: 1 });
    expectOk(await app.deleteCustomer(changeOf(lan, by)));

    expect(await app.getCustomer(lan.id)).toMatchObject({ status: "archived" });
    expect(await app.getOrder(live.id)).toMatchObject({ status: "deleted", deletedWith: lan.id });
    expect(await app.getOrder(before.id)).toMatchObject({
      status: "deleted",
      deletedWith: undefined,
    });
    expect(await app.getReminder(reminder.id)).toMatchObject({
      status: "deleted",
      deletedWith: lan.id,
    });
    expect((await app.orderHistory(live.id)).map((change) => change.kind)).toEqual([
      "placed",
      "deleted",
    ]);
    expect(await app.deletedWithCounts([lan.id])).toEqual(
      new Map([[lan.id, { orders: 1, reminders: 1 }]]),
    );
  });

  it("given a deleted customer, when the trash and the hidden list are read, then they are in the first only, and what went with them shows under them", async () => {
    const app = anApp();
    const by = await theAuthor();
    const lan = await aCustomer(app, "Nha khoa Lan Anh");
    const order = await anOrder(app, lan, [line("Kim", 2, 100_000)]);
    expectOk(await app.deleteCustomer(changeOf(lan, by)));
    const since = Temporal.Instant.from("2026-10-01T00:00:00Z");

    expect((await app.listDeletedCustomers(since, 50)).map((each) => each.id)).toEqual([lan.id]);
    expect((await app.listDeletedOrders(since, 50)).map((each) => each.id)).not.toContain(order.id);
    expect((await app.listCustomers({ status: "archived" })).customers).toEqual([]);
  });

  it("given a deleted customer, when restored from the trash, then what went with them comes back and the rest stays deleted", async () => {
    const app = anApp();
    const by = await theAuthor();
    const lan = await aCustomer(app, "Nha khoa Lan Anh");
    const live = await anOrder(app, lan, [line("Kim", 2, 100_000)]);
    const before = await anOrder(app, lan, [line("Bông gòn", 1, 20_000)]);
    expectOk(await app.deleteOrder(changeOf(before, by)));
    const reminder = await aReminder(app, "Gọi lại", lan.id);
    const deleted = expectOk(await app.deleteCustomer(changeOf(lan, by)));

    const outcome = expectOk(await app.restoreFromTrash(by, [trashed.customer(deleted)]));

    expect(outcome).toEqual({ done: 1, refused: [] });
    expect(await app.getCustomer(lan.id)).toMatchObject({ status: "active" });
    expect(await app.getOrder(live.id)).toMatchObject({ status: "live" });
    expect(await app.getOrder(before.id)).toMatchObject({ status: "deleted" });
    expect(await app.getReminder(reminder.id)).toMatchObject({ status: "live" });
    expect((await app.orderHistory(live.id)).map((change) => change.kind)).toEqual([
      "placed",
      "deleted",
      "restored",
    ]);
  });

  it("given an order deleted with its customer, when it is restored on its own, then it is refused until the customer comes back", async () => {
    const app = anApp();
    const by = await theAuthor();
    const lan = await aCustomer(app, "Nha khoa Lan Anh");
    const live = await anOrder(app, lan, [line("Kim", 2, 100_000)]);
    expectOk(await app.deleteCustomer(changeOf(lan, by)));
    const gone = await app.getOrder(live.id);
    if (gone === undefined) {
      throw new Error("The order is missing");
    }

    expect(await app.restoreOrder(changeOf(gone, by))).toEqual({
      ok: false,
      error: "order_deleted_with_customer",
    });
    expect(expectOk(await app.restoreFromTrash(by, [trashed.order(gone)]))).toEqual({
      done: 0,
      refused: [{ item: trashed.order(gone), error: "trash_customer_deleted" }],
    });
  });

  it("given an order deleted before its customer, when it is restored while the customer is deleted, then it is refused, and comes back with the customer restored in the same go", async () => {
    const app = anApp();
    const by = await theAuthor();
    const lan = await aCustomer(app, "Nha khoa Lan Anh");
    const order = expectOk(
      await app.deleteOrder(changeOf(await anOrder(app, lan, [line("Kim", 1, 100_000)]), by)),
    );
    const deleted = expectOk(await app.deleteCustomer(changeOf(lan, by)));

    expect(expectOk(await app.restoreFromTrash(by, [trashed.order(order)])).refused).toEqual([
      { item: trashed.order(order), error: "trash_customer_deleted" },
    ]);
    expect(
      expectOk(await app.restoreFromTrash(by, [trashed.order(order), trashed.customer(deleted)])),
    ).toEqual({ done: 2, refused: [] });
    expect(await app.getOrder(order.id)).toMatchObject({ status: "live" });
  });
});

describe("deleting a product or a kind", () => {
  it("given a product an order names, when deleted, then it is refused, and one no order names goes to the trash", async () => {
    const app = anApp();
    const by = await theAuthor();
    const order = await anOrder(app, await aCustomer(app, "Sao Mai"), [line("Kim", 1, 100_000)]);
    const [first] = order.lines;
    const sold = first === undefined ? undefined : await app.getProduct(first.productId);
    if (sold === undefined) {
      throw new Error("The product is missing");
    }
    const unsold = expectOk(
      await app.addProduct({ by, name: productNameSchema.parse("Bông gòn") }),
    );

    expect(await app.productOrderCount(sold.id)).toBe(1);
    expect(await app.deleteProduct(changeOf(sold, by))).toEqual({
      ok: false,
      error: "product_in_orders",
    });
    expectOk(await app.deleteProduct(changeOf(unsold, by)));
    expect(await app.getProduct(unsold.id)).toMatchObject({ status: "archived" });
    expect((await app.listProducts({ status: "archived" })).products).toEqual([]);
  });

  it("given two deleted products of one name, when both are restored, then the first comes back and the second is refused, as is one whose name a shown product took", async () => {
    const app = anApp();
    const by = await theAuthor();
    const first = expectOk(await app.addProduct({ by, name: productNameSchema.parse("Gel tê") }));
    const firstGone = expectOk(await app.deleteProduct(changeOf(first, by)));
    const second = expectOk(await app.addProduct({ by, name: productNameSchema.parse("gel te") }));
    const secondGone = expectOk(await app.deleteProduct(changeOf(second, by)));

    const outcome = expectOk(
      await app.restoreFromTrash(by, [trashed.product(firstGone), trashed.product(secondGone)]),
    );

    expect(outcome).toEqual({
      done: 1,
      refused: [{ item: trashed.product(secondGone), error: "trash_name_taken" }],
    });
  });

  it("given a deleted kind, when its customers are read, then they have none until it comes back", async () => {
    const app = anApp();
    const by = await theAuthor();
    const kind = await aKind(app, "Nha khoa");
    const lan = await aCustomer(app, "Lan", { kindId: kind.id });
    const deleted = expectOk(await app.deleteCustomerKind(changeOf(kind, by)));

    expect((await app.listCustomerKinds()).map((each) => each.id)).not.toContain(kind.id);
    expect(await app.getCustomer(lan.id)).toMatchObject({ kindId: kind.id });

    expectOk(await app.restoreFromTrash(by, [trashed.kind(deleted)]));
    expect((await app.listCustomerKinds()).map((each) => each.id)).toContain(kind.id);
  });
});

describe("deleting for good", () => {
  it("given a deleted order, when deleted for good, then it leaves the database with its lines, payments and log", async () => {
    const app = anApp();
    const by = await theAuthor();
    const placed = await anOrder(app, await aCustomer(app, "Sao Mai"), [line("Kim", 1, 100_000)]);
    const paid = expectOk(
      await app.addPayment({
        ...changeOf(placed, by),
        payment: paymentDetailsSchema.parse({
          amount: 50_000,
          paidOn: Temporal.PlainDate.from("2026-10-26"),
        }),
      }),
    );
    const deleted = expectOk(await app.deleteOrder(changeOf(paid, by)));

    expect(await app.purgeFromTrash([trashed.order(deleted)])).toEqual({ done: 1, refused: [] });

    expect(await rowsIn(["sales_order", "order_line", "payment", "order_change"])).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it("given a deleted note, when deleted for good, then the message it was goes too, unless a reminder was made from it", async () => {
    const app = anApp();
    const by = await theAuthor();
    const alone = await recordNote(app, "ghi chú lẻ");
    const kept = await recordNote(app, "nhắc gọi chị Lan");
    const reminder = expectOk(
      await app.addReminder({
        by,
        details: {
          text: content("Gọi chị Lan"),
          dueOn: Temporal.PlainDate.from("2026-10-27"),
          customerId: undefined,
        },
        fromNote: kept.id,
      }),
    );
    const aloneGone = expectOk(await app.deleteNote(changeOf(alone, by)));
    const keptGone = expectOk(await app.deleteNote(changeOf(kept, by)));

    await app.purgeFromTrash([trashed.note(aloneGone), trashed.note(keptGone)]);

    expect(await rows("note")).toBe(0);
    expect(await rows("capture", "id = ?", alone.captureId)).toBe(0);
    expect(await rows("capture", "id = ?", kept.captureId)).toBe(1);

    const reminderGone = expectOk(await app.deleteReminder(changeOf(reminder, by)));
    await app.purgeFromTrash([trashed.reminder(reminderGone)]);
    expect(await rows("capture")).toBe(0);
  });

  it("given a deleted customer others were merged into, when deleted for good, then they go with every order, reminder, name and merge record of theirs", async () => {
    const app = anApp();
    const by = await theAuthor();
    const kept = await aCustomer(app, "Nha khoa Lan Anh");
    const merged = await aCustomer(app, "chị Lan");
    await anOrder(app, merged, [line("Kim", 1, 100_000)]);
    await aReminder(app, "Gọi lại", kept.id);
    expectOk(await app.mergeCustomers({ ...changeOf(merged, by), into: kept.id }));
    const current = await app.getCustomer(kept.id);
    if (current === undefined) {
      throw new Error("The customer is missing");
    }
    const deleted = expectOk(await app.deleteCustomer(changeOf(current, by)));

    expect(await app.purgeFromTrash([trashed.customer(deleted)])).toEqual({
      done: 1,
      refused: [],
    });

    expect(
      await rowsIn([
        "customer",
        "customer_alias",
        "customer_merge",
        "sales_order",
        "order_change",
        "reminder",
      ]),
    ).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("given a deleted kind, when deleted for good, then its customers are left with none, by whoever deleted it", async () => {
    const app = anApp();
    const by = await theAuthor();
    const kind = await aKind(app, "Nha khoa");
    const lan = await aCustomer(app, "Lan", { kindId: kind.id });
    const deleted = expectOk(await app.deleteCustomerKind(changeOf(kind, by)));

    await app.purgeFromTrash([trashed.kind(deleted)]);

    expect(await rows("customer_kind")).toBe(0);
    expect(await app.getCustomer(lan.id)).toMatchObject({
      kindId: undefined,
      audit: { version: lan.audit.version + 1, updatedBy: by },
    });
  });

  it("given something restored since the screen showed it, when deleted for good, then it stays and is said", async () => {
    const app = anApp();
    const by = await theAuthor();
    const note = await recordNote(app, "ghi chú");
    const deleted = expectOk(await app.deleteNote(changeOf(note, by)));
    expectOk(await app.restoreNote(changeOf(deleted, by)));

    expect(await app.purgeFromTrash([trashed.note(deleted)])).toEqual({
      done: 0,
      refused: [{ item: trashed.note(deleted), error: "trash_changed_elsewhere" }],
    });
    expect(await rows("note")).toBe(1);
  });

  it("given things deleted more than thirty days ago and lately, when the daily run empties the trash, then only the old ones go", async () => {
    const time = testClock("2026-09-01T02:00:00Z");
    const app = testApp(time.clock);
    const by = await theAuthor();
    const old = await recordNote(app, "cũ");
    expectOk(await app.deleteNote(changeOf(old, by)));
    time.setTo(monday);
    const recent = await recordNote(app, "mới");
    expectOk(await app.deleteNote(changeOf(recent, by)));
    const db = createDatabase(env.DB);

    await emptyExpiredTrash({ clock: time.clock, startUnitOfWork: () => createUnitOfWork(db) });

    expect(await rows("note", "id = ?", old.id)).toBe(0);
    expect(await rows("note", "id = ?", recent.id)).toBe(1);
  });
});
