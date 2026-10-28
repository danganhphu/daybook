import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import type { App } from "@/composition/create-app";
import { paymentDetailsSchema, type LiveOrder } from "@/features/orders/domain/order";
import { periodContaining } from "@/features/reports/domain/report-period";
import { changeOf, testApp, testClock, theAuthor } from "@/testing/support/app";
import { aCustomer, aKind, anOrder, line } from "@/testing/support/orders";
import { expectOk } from "@/testing/support/result";

const day = (text: string) => Temporal.PlainDate.from(text);

// Today is 23 October 2026 in Vietnam
function anApp() {
  return testApp(testClock("2026-10-23T01:00:00Z").clock);
}

async function pay(app: App, order: LiveOrder, amount: number, paidOn: string) {
  return expectOk(
    await app.addPayment({
      ...changeOf(order, await theAuthor()),
      payment: paymentDetailsSchema.parse({ amount, paidOn: day(paidOn), method: "cash" }),
    }),
  );
}

const october = periodContaining("month", day("2026-10-23"));

// October: four live orders and a deleted one; September: three, one paid in October, one for a customer now hidden
async function aBook() {
  const app = anApp();
  const by = await theAuthor();
  const clinic = await aKind(app, "Nha khoa");
  const agent = await aKind(app, "Đại lý");
  const sunflower = await aCustomer(app, "Hướng Dương", { kindId: clinic.id });
  const morning = await aCustomer(app, "Sao Mai", { kindId: agent.id });
  const dawn = await aCustomer(app, "Bình Minh");
  const lagoon = await aCustomer(app, "Ánh Dương", { kindId: clinic.id });
  const hidden = await aCustomer(app, "Hoa Mai");

  const early = await anOrder(app, sunflower, [line("Thuốc tê", 2, 400_000)], "2026-10-05");
  await pay(app, early, 300_000, "2026-10-23");
  const small = await anOrder(app, morning, [line("Bông gòn", 10, 5_000)], "2026-10-20");
  await pay(app, small, 50_000, "2026-10-20");
  await anOrder(
    app,
    sunflower,
    [line("Thuốc tê", 1, 420_000), line("Bông gòn", 2, 5_000)],
    "2026-10-22",
  );
  await anOrder(app, dawn, [line("Găng tay", 1, 100_000)], "2026-10-10");
  const deleted = await anOrder(app, dawn, [line("Găng tay", 9, 100_000)], "2026-10-11");
  expectOk(await app.deleteOrder(changeOf(deleted, by)));

  const september = await anOrder(app, morning, [line("Thuốc tê", 1, 410_000)], "2026-09-30");
  await pay(app, september, 410_000, "2026-10-02");
  await anOrder(app, lagoon, [line("Găng tay", 4, 100_000)], "2026-09-20");
  await anOrder(app, hidden, [line("Găng tay", 1, 100_000)], "2026-09-01");
  expectOk(await app.archiveCustomer(changeOf(hidden, by)));

  return { app, clinic, agent, sunflower, morning, dawn, lagoon };
}

describe("a month's report", () => {
  it("given a month of orders, when read, then sales count placed orders and money in counts payments made that month, old orders' too", async () => {
    const { app } = await aBook();

    const report = await app.readReport({ period: october });

    expect(report.sales).toEqual({ sales: 1_380_000, orders: 4, units: 16 });
    expect(report.previousSales).toBe(410_000 + 400_000 + 100_000);
    expect(report.received).toBe(300_000 + 50_000 + 410_000);
  });

  it("given a month not yet over, when read, then what is owed is every live order's debt as of today", async () => {
    const { app } = await aBook();

    expect((await app.readReport({ period: october })).owed).toBe(
      500_000 + 430_000 + 100_000 + 400_000 + 100_000,
    );
  });

  it("given a month over, when read, then what is owed leaves out payments made after it ended", async () => {
    const { app } = await aBook();

    const report = await app.readReport({ period: periodContaining("month", day("2026-09-15")) });

    expect(report.owed).toBe(410_000 + 400_000 + 100_000);
    expect(report.received).toBe(0);
  });

  it("given a month, when read, then every day has a column, the empty ones at zero", async () => {
    const { app } = await aBook();

    const { overTime, bucket } = await app.readReport({ period: october });

    expect(bucket).toBe("day");
    expect(overTime).toHaveLength(31);
    expect(
      overTime
        .filter((point) => point.sales > 0)
        .map((point) => [point.start.toString(), point.sales, point.orders]),
    ).toEqual([
      ["2026-10-05", 800_000, 1],
      ["2026-10-10", 100_000, 1],
      ["2026-10-20", 50_000, 1],
      ["2026-10-22", 430_000, 1],
    ]);
  });

  it("given a month, when read, then sales split by kind, product and customer, biggest first, a customer with no kind counted too", async () => {
    const { app, clinic, agent } = await aBook();

    const report = await app.readReport({ period: october });

    expect(report.byKind).toEqual([
      { kindId: clinic.id, kindName: "Nha khoa", sales: 1_230_000 },
      { kindId: undefined, kindName: undefined, sales: 100_000 },
      { kindId: agent.id, kindName: "Đại lý", sales: 50_000 },
    ]);
    expect(report.products?.rows.map((row) => [row.name, row.sales, row.units])).toEqual([
      ["Thuốc tê", 1_220_000, 3],
      ["Găng tay", 100_000, 1],
      ["Bông gòn", 60_000, 12],
    ]);
    expect(report.products?.rest).toBe(0);
    expect(report.customers?.rows.map((row) => [row.name, row.sales])).toEqual([
      ["Hướng Dương", 1_230_000],
      ["Bình Minh", 100_000],
      ["Sao Mai", 50_000],
    ]);
  });

  it("given customers whose last order is three weeks old or more, when read, then they are the quiet ones; a hidden one is not", async () => {
    const { app, lagoon } = await aBook();

    const { quiet } = await app.readReport({ period: october });

    expect(quiet?.afterDays).toBe(21);
    expect(
      quiet?.customers.map((each) => [each.customerId, each.lastOrderedOn.toString()]),
    ).toEqual([[lagoon.id, "2026-09-20"]]);
  });
});

describe("a filtered report", () => {
  it("given a product, when the report is filtered by it, then sales are its lines only and money in and owed are not told", async () => {
    const { app, clinic, sunflower } = await aBook();
    const product = (await app.readReport({ period: october })).products?.rows[0];

    const report = await app.readReport({ period: october, productId: product?.productId });

    expect(report.sales).toEqual({ sales: 1_220_000, orders: 2, units: 3 });
    expect(report.received).toBeUndefined();
    expect(report.owed).toBeUndefined();
    expect(report.products).toBeUndefined();
    expect(report.quiet).toBeUndefined();
    expect(report.byKind).toEqual([{ kindId: clinic.id, kindName: "Nha khoa", sales: 1_220_000 }]);
    expect(report.customers?.rows.map((row) => row.customerId)).toEqual([sunflower.id]);
  });

  it("given a customer, when the report is filtered by them, then every figure is theirs and nothing is broken down by customer or kind", async () => {
    const { app, sunflower } = await aBook();

    const report = await app.readReport({ period: october, customerId: sunflower.id });

    expect(report.sales.sales).toBe(1_230_000);
    expect(report.received).toBe(300_000);
    expect(report.owed).toBe(500_000 + 430_000);
    expect(report.byKind).toBeUndefined();
    expect(report.customers).toBeUndefined();
    expect(report.quiet).toBeUndefined();
    expect(report.products?.rows.map((row) => [row.name, row.sales])).toEqual([
      ["Thuốc tê", 1_220_000],
      ["Bông gòn", 10_000],
    ]);
  });

  it("given a kind, when the report is filtered by it, then only its customers count and quiet ones are of that kind", async () => {
    const { app, agent } = await aBook();

    const report = await app.readReport({ period: october, kindId: agent.id });

    expect(report.sales.sales).toBe(50_000);
    expect(report.byKind).toBeUndefined();
    expect(report.quiet?.customers).toEqual([]);
  });
});

describe("other periods", () => {
  it("given a quarter, when read, then its columns are weeks from Monday", async () => {
    const { app } = await aBook();

    const report = await app.readReport({ period: periodContaining("quarter", day("2026-10-23")) });
    const week = report.overTime.find((point) => point.start.toString() === "2026-10-19");

    expect(report.bucket).toBe("week");
    expect([week?.sales, week?.orders]).toEqual([480_000, 2]);
  });

  it("given a year, when read, then its columns are months", async () => {
    const { app } = await aBook();

    const report = await app.readReport({ period: periodContaining("year", day("2026-10-23")) });

    expect(report.overTime).toHaveLength(12);
    expect(report.overTime.slice(8, 10).map((point) => point.sales)).toEqual([
      410_000 + 400_000 + 100_000,
      1_380_000,
    ]);
  });

  it("given a last order 21 days ago and another 20 days ago, when read, then only the first has gone quiet", async () => {
    const app = anApp();
    const quiet = await aCustomer(app, "Ánh Dương");
    const recent = await aCustomer(app, "Bình Minh");
    await anOrder(app, quiet, [line("Găng tay", 1, 100_000)], "2026-10-02");
    await anOrder(app, recent, [line("Găng tay", 1, 100_000)], "2026-10-03");

    const report = await app.readReport({ period: october });

    expect(report.quiet?.customers.map((each) => each.customerId)).toEqual([quiet.id]);
  });

  it("given a removed payment, when read, then it is not money in and the debt stands", async () => {
    const app = anApp();
    const customer = await aCustomer(app, "Hướng Dương");
    const order = await anOrder(app, customer, [line("Thuốc tê", 1, 400_000)], "2026-10-05");
    const paid = await pay(app, order, 400_000, "2026-10-06");
    const paymentId = paid.payments[0]!.id;
    expectOk(await app.removePayment({ ...changeOf(paid, await theAuthor()), paymentId }));

    const report = await app.readReport({ period: october });

    expect([report.received, report.owed]).toEqual([0, 400_000]);
  });
});
