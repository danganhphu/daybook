import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import type { App } from "@/composition/create-app";
import { createUnitOfWork } from "@/composition/unit-of-work";
import type { CustomerId } from "@/features/customers/domain/customer";
import { createCustomerRepository } from "@/features/customers/infrastructure/customer-repository";
import type { MergingDeps } from "@/features/merging/application/merging-deps";
import type { LiveOrder, Order } from "@/features/orders/domain/order";
import { createOrderRepository } from "@/features/orders/infrastructure/order-repository";
import { productNameSchema, type ProductId } from "@/features/products/domain/product";
import { createProductRepository } from "@/features/products/infrastructure/product-repository";
import type { MessageReader } from "@/features/reading/application/message-reader";
import { createReminderRepository } from "@/features/reminders/infrastructure/reminder-repository";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import {
  changeOf,
  content,
  recordNote,
  testApp,
  testClock,
  theAuthor,
} from "@/testing/support/app";
import { aCustomer, anOrder, line } from "@/testing/support/orders";
import { aLine, anOrderReading, readerOf } from "@/testing/support/readings";
import { expectOk } from "@/testing/support/result";

import { mergeCustomers } from "./merge-customers";

const monday = "2026-10-26T02:00:00Z";

function anApp(reader?: MessageReader) {
  return testApp(testClock(monday).clock, reader);
}

function firstProduct(order: Order): ProductId {
  const [first] = order.lines;
  if (first === undefined) {
    throw new Error("The order has no lines");
  }

  return first.productId;
}

async function productOf(app: App, id: ProductId) {
  const product = await app.getProduct(id);
  if (product === undefined) {
    throw new Error("The product is missing");
  }

  return product;
}

async function aReminder(app: App, text: string, customerId: CustomerId) {
  return expectOk(
    await app.addReminder({
      by: await theAuthor(),
      details: { text: content(text), dueOn: Temporal.PlainDate.from("2026-10-27"), customerId },
      fromNote: undefined,
    }),
  );
}

async function otherNamesOf(app: App, customerId: CustomerId) {
  return (await app.customerAliases(customerId)).map((alias) => alias.name);
}

async function rows(table: "customer_merge" | "product_merge") {
  const found = await env.DB.prepare(`select count(*) as count from ${table}`).first<{
    count: number;
  }>();

  return found?.count ?? 0;
}

describe("merging customers", () => {
  it("given two customers who are one, when merged, then every order and reminder moves, each order's log says so, and the merged one is hidden with its names kept", async () => {
    const app = anApp();
    const by = await theAuthor();
    const kept = await aCustomer(app, "Nha khoa Lan Anh");
    const merged = await aCustomer(app, "chị Lan");
    expectOk(await app.addCustomerAlias({ by, customerId: merged.id, name: "Lan nk" }));
    const live = await anOrder(app, merged, [line("Kim", 2, 100_000)]);
    const deleted = await anOrder(app, merged, [line("Bông gòn", 1, 20_000)]);
    expectOk(await app.deleteOrder(changeOf(deleted, by)));
    await anOrder(app, kept, [line("Kim", 1, 100_000)]);
    const reminder = await aReminder(app, "Gọi lại", merged.id);

    expect(await app.customerMergePreview(merged.id)).toEqual({ orders: 1, reminders: 1 });
    expectOk(await app.mergeCustomers({ ...changeOf(merged, by), into: kept.id }));

    expect((await app.getOrder(live.id))?.customerId).toBe(kept.id);
    expect((await app.getOrder(deleted.id))?.customerId).toBe(kept.id);
    expect((await app.getReminder(reminder.id))?.customerId).toBe(kept.id);
    expect((await app.orderHistory(live.id)).map((change) => change.kind)).toEqual([
      "placed",
      "customer_merged",
    ]);
    expect(await app.getCustomer(merged.id)).toMatchObject({
      status: "archived",
      mergedInto: kept.id,
    });
    expect(await otherNamesOf(app, kept.id)).toEqual(["chị Lan", "Lan nk"]);
    expect(await otherNamesOf(app, merged.id)).toEqual([]);
    expect(await app.customerAccount(kept.id)).toMatchObject({ orderCount: 2, total: 300_000 });
    expect(await rows("customer_merge")).toBe(1);
  });

  // The kept name shares no word with "chị Lan", so only the other name can match it
  it("given a merge, when a message later calls the customer by the merged name, then the reading finds the one kept", async () => {
    const text = "bán 1 hộp kim cho chị Lan 100k";
    const app = anApp(readerOf({ [text]: anOrderReading("chị Lan", [aLine("kim", 1, "100k")]) }));
    const by = await theAuthor();
    const kept = await aCustomer(app, "Nha khoa Hướng Dương");
    const merged = await aCustomer(app, "chị Lan");
    expectOk(await app.mergeCustomers({ ...changeOf(merged, by), into: kept.id }));
    const note = await recordNote(app, text);

    const settled = expectOk(await app.readNote({ by, noteId: note.id, again: false }));

    expect(settled.order?.order.customerId).toBe(kept.id);
  });

  it("given a merge asked for wrongly, when it is refused, then it says why: itself, an old screen, a hidden one to keep, one merged already", async () => {
    const app = anApp();
    const by = await theAuthor();
    const kept = await aCustomer(app, "Nha khoa Lan Anh");
    const hidden = expectOk(await app.archiveCustomer(changeOf(await aCustomer(app, "Đã ẩn"), by)));
    const merged = await aCustomer(app, "chị Lan");

    expect(await app.mergeCustomers({ ...changeOf(merged, by), into: merged.id })).toEqual({
      ok: false,
      error: "merge_into_itself",
    });
    expect(await app.mergeCustomers({ ...changeOf(merged, by), into: hidden.id })).toEqual({
      ok: false,
      error: "customer_kept_unavailable",
    });
    const done = expectOk(await app.mergeCustomers({ ...changeOf(merged, by), into: kept.id }));
    expect(done.intoId).toBe(kept.id);
    expect(await app.mergeCustomers({ ...changeOf(merged, by), into: kept.id })).toEqual({
      ok: false,
      error: "customer_changed_elsewhere",
    });
    const now = await app.getCustomer(merged.id);
    if (now === undefined) {
      throw new Error("The merged customer is gone");
    }
    expect(await app.mergeCustomers({ ...changeOf(now, by), into: kept.id })).toEqual({
      ok: false,
      error: "customer_merged",
    });
    expect(await app.restoreCustomer(changeOf(now, by))).toEqual({
      ok: false,
      error: "customer_merged",
    });
  });

  it("given an order changed on another phone while a merge reads, when the merge commits, then nothing moves at all", async () => {
    const app = anApp();
    const by = await theAuthor();
    const kept = await aCustomer(app, "Nha khoa Lan Anh");
    const merged = await aCustomer(app, "chị Lan");
    const first: LiveOrder = await anOrder(app, merged, [line("Kim", 1, 100_000)]);
    const second = await anOrder(app, merged, [line("Bông gòn", 1, 20_000)]);
    const db = createDatabase(env.DB);
    const orders = createOrderRepository(db);
    const deps: MergingDeps = {
      clock: testClock(monday).clock,
      customers: createCustomerRepository(db),
      products: createProductRepository(db),
      reminders: createReminderRepository(db),
      orders: {
        ...orders,
        async forCustomer(customerId) {
          const found = await orders.forCustomer(customerId);
          // The other person delivers the second order after the merge has read it
          expectOk(
            await app.deliverOrder({
              ...changeOf(second, by),
              on: Temporal.PlainDate.from("2026-10-26"),
            }),
          );
          return found;
        },
      },
      startUnitOfWork: () => createUnitOfWork(db),
    };

    expect(await mergeCustomers(deps, { ...changeOf(merged, by), into: kept.id })).toEqual({
      ok: false,
      error: "customer_changed_elsewhere",
    });
    expect((await app.getOrder(first.id))?.customerId).toBe(merged.id);
    expect((await app.getCustomer(merged.id))?.status).toBe("active");
    expect(await otherNamesOf(app, kept.id)).toEqual([]);
    expect(await rows("customer_merge")).toBe(0);
  });
});

describe("merging products", () => {
  it("given two products that are one, when merged, then their lines move at their own quantity and price, the log says so, and the merged one's names follow", async () => {
    const app = anApp();
    const by = await theAuthor();
    const customer = await aCustomer(app, "Hướng Dương");
    const keptOrder = await anOrder(app, customer, [line("Thuốc tê Lidocaine", 1, 100_000)]);
    const both = await anOrder(app, customer, [
      line("gel tê", 2, 40_000),
      line("Thuốc tê Lidocaine", 1, 100_000),
    ]);
    const into = firstProduct(keptOrder);
    const from = firstProduct(both);
    expectOk(
      await app.addProductAlias({ by, productId: from, name: productNameSchema.parse("gel") }),
    );
    const merged = await productOf(app, from);

    expect(await app.productMergePreview(from)).toEqual({ orders: 1, reminders: 0 });
    expectOk(await app.mergeProducts({ ...changeOf(merged, by), into }));

    expect((await app.getOrder(both.id))?.lines).toEqual([
      { productId: into, quantity: 2, unitPrice: 40_000 },
      { productId: into, quantity: 1, unitPrice: 100_000 },
    ]);
    expect((await app.orderHistory(both.id)).map((change) => change.kind)).toEqual([
      "placed",
      "product_merged",
    ]);
    expect(await app.getProduct(from)).toMatchObject({ status: "archived", mergedInto: into });
    expect((await app.productAliases(into)).map((alias) => alias.name)).toEqual(["gel tê", "gel"]);
    expect(await app.productAliases(from)).toEqual([]);
    const usage = await app.productUsage();
    expect(usage.get(into)?.orderCount).toBe(2);
    expect(usage.has(from)).toBe(false);
    expect(await rows("product_merge")).toBe(1);
  });

  it("given a merged product, when an order names it by its old name, then it is the one kept", async () => {
    const app = anApp();
    const by = await theAuthor();
    const customer = await aCustomer(app, "Hướng Dương");
    const into = firstProduct(await anOrder(app, customer, [line("Thuốc tê", 1, 100_000)]));
    const from = firstProduct(await anOrder(app, customer, [line("gel tê", 1, 40_000)]));
    expectOk(await app.mergeProducts({ ...changeOf(await productOf(app, from), by), into }));

    const later = await anOrder(app, customer, [line("Gel Tê", 3, 40_000)]);

    expect(firstProduct(later)).toBe(into);
    expect(await app.restoreProduct(changeOf(await productOf(app, from), by))).toEqual({
      ok: false,
      error: "product_merged",
    });
  });

  it("given a merge asked for wrongly, when it is refused, then it says why: itself, a hidden one to keep, an old screen, one merged already", async () => {
    const app = anApp();
    const by = await theAuthor();
    const customer = await aCustomer(app, "Hướng Dương");
    const into = firstProduct(await anOrder(app, customer, [line("Thuốc tê", 1, 100_000)]));
    const hidden = firstProduct(await anOrder(app, customer, [line("Bông gòn", 1, 20_000)]));
    expectOk(await app.archiveProduct(changeOf(await productOf(app, hidden), by)));
    const merged = await productOf(
      app,
      firstProduct(await anOrder(app, customer, [line("gel tê", 1, 40_000)])),
    );

    expect(await app.mergeProducts({ ...changeOf(merged, by), into: merged.id })).toEqual({
      ok: false,
      error: "merge_into_itself",
    });
    expect(await app.mergeProducts({ ...changeOf(merged, by), into: hidden })).toEqual({
      ok: false,
      error: "product_kept_unavailable",
    });
    expectOk(await app.mergeProducts({ ...changeOf(merged, by), into }));
    expect(await app.mergeProducts({ ...changeOf(merged, by), into })).toEqual({
      ok: false,
      error: "product_changed_elsewhere",
    });
    expect(
      await app.mergeProducts({ ...changeOf(await productOf(app, merged.id), by), into }),
    ).toEqual({ ok: false, error: "product_merged" });
  });
});
