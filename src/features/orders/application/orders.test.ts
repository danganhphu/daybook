import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import type { OrderFilter } from "@/features/orders/application/order-queries";
import { paymentDetailsSchema } from "@/features/orders/domain/order";
import { productIdSchema } from "@/features/products/domain/product";
import { changeOf, testApp, testClock, theAuthor, thePartner } from "@/testing/support/app";
import { aCustomer, aKind, anOrder, line, lineOf } from "@/testing/support/orders";
import { expectOk } from "@/testing/support/result";

const day = (text: string) => Temporal.PlainDate.from(text);

function anApp() {
  return testApp(testClock("2026-10-23T01:00:00Z").clock);
}

function payment(amount: number) {
  return paymentDetailsSchema.parse({ amount, paidOn: day("2026-10-23"), method: "cash" });
}

describe("placing an order", () => {
  it("given product names never seen, when ordered, then they become products, one per name whatever its case or accents", async () => {
    const app = anApp();
    const customer = await aCustomer(app, "Hướng Dương");

    const order = await anOrder(app, customer, [
      line("Thuốc tê Lidocaine", 2, 425_000),
      line("thuoc te lidocaine", 1, 425_000),
      line("Găng tay", 10, 5_000),
    ]);
    const products = await app.getProducts(order.lines.map((orderLine) => orderLine.productId));

    expect(new Set(order.lines.map((orderLine) => orderLine.productId)).size).toBe(2);
    expect(products.map((product) => product.name).toSorted()).toEqual([
      "Găng tay",
      "Thuốc tê Lidocaine",
    ]);
  });

  it("given a product named in an earlier order, when named again without accents, then it is the same product", async () => {
    const app = anApp();
    const customer = await aCustomer(app, "Hướng Dương");
    const first = await anOrder(app, customer, [line("Thuốc tê Lidocaine", 1, 425_000)]);

    const second = await anOrder(app, customer, [line("THUOC TE LIDOCAINE", 3, 420_000)]);

    expect(second.lines[0]?.productId).toBe(first.lines[0]?.productId);
  });

  it("given a hidden customer, when an order is placed for them, then it is refused", async () => {
    const app = anApp();
    const by = await theAuthor();
    const customer = await aCustomer(app, "Hướng Dương");
    expectOk(await app.archiveCustomer(changeOf(customer, by)));

    expect(
      await app.placeOrder({
        by,
        order: {
          customerId: customer.id,
          orderedOn: day("2026-10-23"),
          lines: [line("x", 1, 1)],
          note: undefined,
        },
      }),
    ).toEqual({ ok: false, error: "customer_unavailable" });
  });

  it("given a product id that does not exist, when ordered, then it is refused and nothing is stored", async () => {
    const app = anApp();
    const customer = await aCustomer(app, "Hướng Dương");
    const missing = productIdSchema.parse("019a0000-0000-7000-8000-0000000000d9");

    expect(
      await app.placeOrder({
        by: await theAuthor(),
        order: {
          customerId: customer.id,
          orderedOn: day("2026-10-23"),
          lines: [line("Kim mới", 1, 1), lineOf(missing, 1, 1)],
          note: undefined,
        },
      }),
    ).toEqual({ ok: false, error: "product_not_found" });
    expect(await app.listOrders({ from: day("2026-10-01"), to: day("2026-10-31") }, 50)).toEqual(
      [],
    );
  });
});

describe("changing an order", () => {
  it("given an order, when the other person adds a payment, delivers and revises it, then the history says each, by whom, in order", async () => {
    const app = anApp();
    const author = await theAuthor();
    const partner = await thePartner();
    const placed = await anOrder(app, await aCustomer(app, "Hướng Dương"), [
      line("Thuốc tê", 2, 425_000),
    ]);

    const paidPart = expectOk(
      await app.addPayment({ ...changeOf(placed, partner), payment: payment(300_000) }),
    );
    const delivered = expectOk(
      await app.deliverOrder({ ...changeOf(paidPart, author), on: day("2026-10-24") }),
    );
    const revised = expectOk(
      await app.reviseOrder({
        ...changeOf(delivered, partner),
        order: {
          customerId: placed.customerId,
          orderedOn: placed.orderedOn,
          lines: [line("Thuốc tê", 3, 425_000)],
          note: "thêm 1 thùng",
        },
      }),
    );
    const history = await app.orderHistory(placed.id);

    expect(revised.audit.version).toBe(4);
    expect(history.map((change) => [change.kind, change.by])).toEqual([
      ["placed", author],
      ["payment_added", partner],
      ["delivered", author],
      ["revised", partner],
    ]);
    expect(history[3]?.before?.lines[0]?.quantity).toBe(2);
    expect(history[3]?.after.lines[0]?.quantity).toBe(3);
    expect(history[3]?.after.note).toBe("thêm 1 thùng");
  });

  it("given two people taking a payment for the same order at once, when both save, then the second is refused and nothing is paid twice", async () => {
    const app = anApp();
    const shown = await anOrder(app, await aCustomer(app, "Hướng Dương"), [
      line("Thuốc tê", 1, 500_000),
    ]);
    expectOk(
      await app.addPayment({ ...changeOf(shown, await theAuthor()), payment: payment(500_000) }),
    );

    expect(
      await app.addPayment({ ...changeOf(shown, await thePartner()), payment: payment(500_000) }),
    ).toEqual({
      ok: false,
      error: "order_changed_elsewhere",
    });
    expect((await app.getOrder(shown.id))?.payments).toHaveLength(1);
  });

  it("given a payment, when removed, then it stays on record as removed and what is owed comes back", async () => {
    const app = anApp();
    const by = await theAuthor();
    const placed = await anOrder(app, await aCustomer(app, "Hướng Dương"), [
      line("Thuốc tê", 1, 500_000),
    ]);
    const paidPart = expectOk(
      await app.addPayment({ ...changeOf(placed, by), payment: payment(200_000) }),
    );
    const [taken] = paidPart.payments;

    const removed = expectOk(
      await app.removePayment({ ...changeOf(paidPart, by), paymentId: taken!.id }),
    );
    const stored = await app.getOrder(placed.id);

    expect(removed.payments[0]?.removal?.deletedBy).toBe(by);
    expect(stored?.payments).toEqual(removed.payments);
  });

  it("given an order revised with fewer lines and a new product, when read back, then exactly the new lines are there", async () => {
    const app = anApp();
    const by = await theAuthor();
    const placed = await anOrder(app, await aCustomer(app, "Hướng Dương"), [
      line("Thuốc tê", 1, 1_000),
      line("Bông gòn", 2, 2_000),
      line("Kẹp", 3, 3_000),
    ]);

    expectOk(
      await app.reviseOrder({
        ...changeOf(placed, by),
        order: {
          customerId: placed.customerId,
          orderedOn: placed.orderedOn,
          lines: [lineOf(placed.lines[2]!.productId, 4, 3_000), line("Kim nha khoa", 1, 50_000)],
          note: undefined,
        },
      }),
    );
    const stored = await app.getOrder(placed.id);

    expect(stored?.lines.map((orderLine) => [orderLine.quantity, orderLine.unitPrice])).toEqual([
      [4, 3_000],
      [1, 50_000],
    ]);
  });

  it("given an order, when deleted twice and restored, then the history has one deletion and one restore", async () => {
    const app = anApp();
    const by = await theAuthor();
    const placed = await anOrder(app, await aCustomer(app, "Hướng Dương"), [
      line("Thuốc tê", 1, 1_000),
    ]);

    const deleted = expectOk(await app.deleteOrder(changeOf(placed, by)));
    expectOk(await app.deleteOrder(changeOf(placed, by)));
    expectOk(await app.restoreOrder(changeOf(deleted, by)));

    expect((await app.orderHistory(placed.id)).map((change) => change.kind)).toEqual([
      "placed",
      "deleted",
      "restored",
    ]);
  });
});

describe("reading orders", () => {
  async function aBook() {
    const app = anApp();
    const by = await theAuthor();
    const clinic = await aKind(app, "Nha khoa");
    const sunflower = await aCustomer(app, "Hướng Dương", { kindId: clinic.id });
    const morning = await aCustomer(app, "Sao Mai");
    const october = await anOrder(app, sunflower, [line("Thuốc tê", 2, 400_000)], "2026-10-05");
    const paidOff = await anOrder(app, morning, [line("Bông gòn", 10, 5_000)], "2026-10-20");
    expectOk(await app.addPayment({ ...changeOf(paidOff, by), payment: payment(50_000) }));
    const delivered = await anOrder(
      app,
      sunflower,
      [line("Thuốc tê", 1, 420_000), line("Bông gòn", 2, 5_000)],
      "2026-10-22",
    );
    expectOk(await app.deliverOrder({ ...changeOf(delivered, by), on: day("2026-10-23") }));
    await anOrder(app, morning, [line("Thuốc tê", 1, 410_000)], "2026-09-30");

    return { app, clinic, sunflower, morning, october, paidOff, delivered };
  }

  const october = { from: day("2026-10-01"), to: day("2026-10-31") };

  it("given orders across two months, when October is listed, then only October's come, newest first, with their products", async () => {
    const { app } = await aBook();

    const rows = await app.listOrders(october, 50);

    expect(
      rows.map((row) => [row.orderedOn.toString(), row.customerName, row.productNames, row.total]),
    ).toEqual([
      ["2026-10-22", "Hướng Dương", ["Thuốc tê", "Bông gòn"], 430_000],
      ["2026-10-20", "Sao Mai", ["Bông gòn"], 50_000],
      ["2026-10-05", "Hướng Dương", ["Thuốc tê"], 800_000],
    ]);
  });

  it("given orders, when October is summed, then the totals add up and what is owed is counted per order", async () => {
    const { app } = await aBook();

    expect(await app.orderTotals(october)).toEqual({
      count: 3,
      total: 1_280_000,
      paid: 50_000,
      owed: 1_230_000,
    });
  });

  it("given filters, when listed, then each narrows the list", async () => {
    const { app, clinic, morning, paidOff, delivered } = await aBook();
    const ids = async (filter: Partial<OrderFilter>) =>
      (await app.listOrders({ ...october, ...filter }, 50)).map((row) => row.id);
    const paper = delivered.lines[0]!.productId;

    expect(await ids({ customerId: morning.id })).toEqual([paidOff.id]);
    expect(await ids({ kindId: clinic.id })).toHaveLength(2);
    expect(await ids({ delivery: "delivered" })).toEqual([delivered.id]);
    expect(await ids({ payment: "paid" })).toEqual([paidOff.id]);
    expect(await ids({ payment: "owed" })).toHaveLength(2);
    expect(await ids({ productId: paper })).toHaveLength(2);
  });

  it("given a deleted order, when listed or summed, then it is left out", async () => {
    const { app, october: first } = await aBook();
    expectOk(await app.deleteOrder(changeOf(first, await theAuthor())));

    expect((await app.orderTotals(october)).count).toBe(2);
    expect(await app.listOrders(october, 50)).toHaveLength(2);
  });

  it("given customers' orders, when their debts are read, then each owes the sum of their open orders", async () => {
    const { app, sunflower, morning } = await aBook();

    const owed = await app.owedByCustomer();

    expect(owed.get(sunflower.id)).toBe(800_000 + 430_000);
    expect(owed.get(morning.id)).toBe(410_000);
    expect(await app.customerAccount(sunflower.id)).toEqual({
      orderCount: 2,
      total: 1_230_000,
      owed: 1_230_000,
      lastOrderedOn: day("2026-10-22"),
    });
  });

  it("given a product sold at different prices, when its last price is read, then this customer's latest comes first, else anyone's", async () => {
    const { app, sunflower, morning, delivered } = await aBook();
    const paper = delivered.lines[0]!.productId;

    expect((await app.lastPrices([paper], sunflower.id)).get(paper)).toBe(420_000);
    expect((await app.lastPrices([paper], morning.id)).get(paper)).toBe(410_000);
    expect((await app.lastPrices([paper], undefined)).get(paper)).toBe(420_000);
  });
});
