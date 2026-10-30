import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { paymentDetailsSchema } from "@/features/orders/domain/order";
import { changeOf, testApp, testClock, theAuthor } from "@/testing/support/app";
import { aCustomer, anOrder, line } from "@/testing/support/orders";
import { expectOk } from "@/testing/support/result";

// "uards the hand-written parts of the orders migration that the use cases never exercise: the rows a hand-written
// query could otherwise rewrite

async function anOrderWithAPayment() {
  const app = testApp(testClock("2026-10-23T01:00:00Z").clock);
  const placed = await anOrder(app, await aCustomer(app, "Hướng Dương"), [
    line("Thuốc tê", 1, 500_000),
  ]);
  const paid = expectOk(
    await app.addPayment({
      ...changeOf(placed, await theAuthor()),
      payment: paymentDetailsSchema.parse({
        amount: 100_000,
        paidOn: Temporal.PlainDate.from("2026-10-23"),
      }),
    }),
  );

  return { orderId: paid.id, paymentId: paid.payments[0]?.id };
}

describe("payment table", () => {
  it.each(["amount = 1", "paid_on = '2026-10-01'", "note = 'sửa lén'"])(
    "given a payment, when %s is written over it, then the trigger refuses",
    async (rewrite) => {
      const { paymentId } = await anOrderWithAPayment();

      await expect(
        env.DB.prepare(`update payment set ${rewrite} where id = ?`).bind(paymentId).run(),
      ).rejects.toThrow(/a payment is only ever removed/);
    },
  );

  it("given a payment of a live order, when deleted outright, then the trigger refuses", async () => {
    const { paymentId } = await anOrderWithAPayment();

    await expect(
      env.DB.prepare("delete from payment where id = ?").bind(paymentId).run(),
    ).rejects.toThrow(/a payment goes only with its deleted order/);
  });
});

describe("order_change table", () => {
  it("given the log, when rewritten, then the trigger refuses", async () => {
    const { orderId } = await anOrderWithAPayment();

    await expect(
      env.DB.prepare("update order_change set kind = 'revised' where order_id = ?")
        .bind(orderId)
        .run(),
    ).rejects.toThrow(/order_change is append-only/);
  });

  it("given the log of a live order, when deleted, then the trigger refuses", async () => {
    const { orderId } = await anOrderWithAPayment();

    await expect(
      env.DB.prepare("delete from order_change where order_id = ?").bind(orderId).run(),
    ).rejects.toThrow(/order_change goes only with its deleted order/);
  });
});

describe("sales_order table", () => {
  it("given an order, when delivered before it was ordered, then the check refuses", async () => {
    const { orderId } = await anOrderWithAPayment();

    await expect(
      env.DB.prepare(
        "update sales_order set delivered_on = '2026-10-01', version = version + 1 where id = ?",
      )
        .bind(orderId)
        .run(),
    ).rejects.toThrow(/sales_order_delivered_on_day/);
  });
});
