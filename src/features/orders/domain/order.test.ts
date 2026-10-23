import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { customerIdSchema } from "@/features/customers/domain/customer";
import { productIdSchema } from "@/features/products/domain/product";
import { accountIdSchema } from "@/shared/domain/account-id";
import { moneyMax, moneySchema } from "@/shared/domain/money";
import { expectOk } from "@/testing/support/result";

import * as Orders from "./order";
import { orderDetailsSchema, paymentDetailsSchema, paymentIdSchema } from "./order";
import * as OrderChanges from "./order-change";

const seller = accountIdSchema.parse("019a0000-0000-7000-8000-0000000000a1");
const partner = accountIdSchema.parse("019a0000-0000-7000-8000-0000000000b2");
const customer = customerIdSchema.parse("019a0000-0000-7000-8000-0000000000c1");
const paper = productIdSchema.parse("019a0000-0000-7000-8000-0000000000d1");
const pens = productIdSchema.parse("019a0000-0000-7000-8000-0000000000d2");
const at = Temporal.Instant.from("2026-10-23T01:00:00Z");
const later = Temporal.Instant.from("2026-10-23T02:00:00Z");
const day = (text: string) => Temporal.PlainDate.from(text);

function details(lines = [{ productId: paper, quantity: 2, unitPrice: 425_000 }]) {
  return orderDetailsSchema.parse({ customerId: customer, orderedOn: day("2026-10-23"), lines });
}

function payment(amount: number, paidOn = "2026-10-23") {
  return paymentDetailsSchema.parse({ amount, paidOn: day(paidOn) });
}

function anOrder() {
  return expectOk(Orders.place(details(), seller, at));
}

describe("an order's money", () => {
  it("given two lines, when totalled, then it is quantity times price summed", () => {
    const order = expectOk(
      Orders.place(
        details([
          { productId: paper, quantity: 2, unitPrice: 425_000 },
          { productId: pens, quantity: 10, unitPrice: 5_000 },
        ]),
        seller,
        at,
      ),
    );

    expect(Orders.total(order)).toBe(900_000);
    expect(Orders.paid(order)).toBe(0);
    expect(Orders.owed(order)).toBe(900_000);
  });

  it("given payments, when one is removed, then it no longer counts as paid", () => {
    const first = expectOk(Orders.addPayment(anOrder(), payment(300_000), seller, at));
    const second = expectOk(Orders.addPayment(first.order, payment(200_000), partner, later));

    const removed = expectOk(Orders.removePayment(second.order, first.payment.id, partner, later));

    expect(Orders.paid(second.order)).toBe(500_000);
    expect(Orders.paid(removed)).toBe(200_000);
    expect(Orders.owed(removed)).toBe(650_000);
    expect(removed.payments.find((p) => p.id === first.payment.id)?.removal).toEqual({
      deletedAt: later,
      deletedBy: partner,
    });
  });

  it("given a line whose amount passes what money can hold, when placed, then it is refused", () => {
    const huge = details([{ productId: paper, quantity: 100_000, unitPrice: moneyMax }]);

    expect(Orders.place(huge, seller, at)).toEqual({ ok: false, error: "order_too_large" });
  });
});

describe("the rules an order keeps", () => {
  it("given what is owed, when more than that is paid, then it is refused; exactly that is accepted", () => {
    const order = anOrder();

    expect(Orders.addPayment(order, payment(850_001), seller, at)).toEqual({
      ok: false,
      error: "payment_exceeds_owed",
    });
    expect(
      Orders.owed(expectOk(Orders.addPayment(order, payment(850_000), seller, at)).order),
    ).toBe(0);
  });

  it("given a payment, when the order is revised below what was paid, then it is refused", () => {
    const paidPart = expectOk(Orders.addPayment(anOrder(), payment(500_000), seller, at)).order;

    expect(
      Orders.revise(
        paidPart,
        details([{ productId: paper, quantity: 1, unitPrice: 425_000 }]),
        seller,
        later,
      ),
    ).toEqual({ ok: false, error: "total_below_paid" });
  });

  it("given an order, when delivered before the day it was ordered, then it is refused", () => {
    expect(Orders.deliver(anOrder(), day("2026-10-22"), seller, at)).toEqual({
      ok: false,
      error: "delivered_before_ordered",
    });
  });

  it("given a delivered order, when its order day is moved past the delivery, then it is refused", () => {
    const delivered = expectOk(Orders.deliver(anOrder(), day("2026-10-24"), seller, at));
    const moved = orderDetailsSchema.parse({ ...details(), orderedOn: day("2026-10-25") });

    expect(Orders.revise(delivered, moved, seller, later)).toEqual({
      ok: false,
      error: "delivered_before_ordered",
    });
  });

  it("given a delivered order, when undelivered, then it has no delivery day and its version moved twice", () => {
    const delivered = expectOk(Orders.deliver(anOrder(), day("2026-10-24"), seller, at));

    const undelivered = expectOk(Orders.undeliver(delivered, partner, later));

    expect(Orders.isDelivered(undelivered)).toBe(false);
    expect(undelivered).not.toHaveProperty("deliveredOn");
    expect(undelivered.audit.version).toBe(3);
  });

  it("given a deleted order, when changed in any way, then it is refused; when deleted again, then it is as it was", () => {
    const deleted = Orders.markDeleted(anOrder(), seller, at);
    const refused = { ok: false, error: "order_deleted" };

    expect(Orders.revise(deleted, details(), seller, later)).toEqual(refused);
    expect(Orders.deliver(deleted, day("2026-10-23"), seller, later)).toEqual(refused);
    expect(Orders.addPayment(deleted, payment(1), seller, later)).toEqual(refused);
    expect(Orders.markDeleted(deleted, partner, later)).toBe(deleted);
  });

  it("given a payment that is unknown or already removed, when removed, then it is refused", () => {
    const { order, payment: kept } = expectOk(
      Orders.addPayment(anOrder(), payment(100_000), seller, at),
    );
    const removed = expectOk(Orders.removePayment(order, kept.id, seller, later));
    const unknown = paymentIdSchema.parse("019a0000-0000-7000-8000-0000000000e9");

    expect(Orders.removePayment(removed, kept.id, seller, later)).toEqual({
      ok: false,
      error: "payment_not_found",
    });
    expect(Orders.removePayment(order, unknown, seller, later)).toEqual({
      ok: false,
      error: "payment_not_found",
    });
  });

  it("given a deleted order, when restored, then it is live with its lines and payments", () => {
    const paidPart = expectOk(Orders.addPayment(anOrder(), payment(100_000), seller, at)).order;

    const restored = expectOk(
      Orders.restore(Orders.markDeleted(paidPart, seller, at), partner, later),
    );

    expect(restored.status).toBe("live");
    expect(restored).not.toHaveProperty("deletion");
    expect(restored.payments).toEqual(paidPart.payments);
    expect(restored.audit.updatedBy).toBe(partner);
  });
});

describe("the change log", () => {
  it("given a payment added, when recorded, then it says who, when, and the order before and after", () => {
    const order = anOrder();
    const { order: after } = expectOk(Orders.addPayment(order, payment(100_000), partner, later));

    const change = OrderChanges.record("payment_added", order, after);

    expect(change.kind).toBe("payment_added");
    expect(change.by).toBe(partner);
    expect(change.at).toBe(later);
    expect(change.before?.payments).toEqual([]);
    expect(change.after.payments).toEqual([
      expect.objectContaining({
        amount: moneySchema.parse(100_000),
        paidOn: "2026-10-23",
        removed: false,
      }),
    ]);
  });

  it("given a snapshot, when read back as JSON, then it is the same", () => {
    const delivered = expectOk(Orders.deliver(anOrder(), day("2026-10-24"), seller, at));
    const snapshot = OrderChanges.snapshot(delivered);

    expect(OrderChanges.orderSnapshotSchema.parse(JSON.parse(JSON.stringify(snapshot)))).toEqual(
      snapshot,
    );
  });
});
