import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { customerIdSchema } from "@/features/customers/domain/customer";
import { productIdSchema } from "@/features/products/domain/product";
import type { AccountId } from "@/shared/domain/account-id";
import { calendarDaySchema } from "@/shared/domain/calendar-day";
import { moneySchema } from "@/shared/domain/money";

import { paymentIdSchema, paymentMethods, type Order, type OrderId } from "./order";

// Every change to an order, kept for good (ADR 0011, decision 10): who, when, what kind, and the order before and
// after. Money needs the trail; the order's page shows it as its history. Names are not copied in: the ids are, and
// the page looks them up, so a renamed customer reads under its new name.

export const orderChangeKinds = [
  "placed",
  "revised",
  "delivered",
  "undelivered",
  "payment_added",
  "payment_removed",
  "deleted",
  "restored",
  // A merge moved the order to the customer, or a line to the product, that was kept
  "customer_merged",
  "product_merged",
] as const;

export type OrderChangeKind = (typeof orderChangeKinds)[number];

export const orderChangeIdSchema = z.uuid().brand<"OrderChangeId">();

export type OrderChangeId = z.infer<typeof orderChangeIdSchema>;

// The order as plain JSON, for the log. Days are YYYY-MM-DD.
export const orderSnapshotSchema = z.object({
  customerId: customerIdSchema,
  orderedOn: calendarDaySchema.transform((day) => day.toString()),
  deliveredOn: calendarDaySchema.transform((day) => day.toString()).nullable(),
  note: z.string().nullable(),
  lines: z.array(
    z.object({ productId: productIdSchema, quantity: z.number().int(), unitPrice: moneySchema }),
  ),
  payments: z.array(
    z.object({
      id: paymentIdSchema,
      amount: moneySchema,
      paidOn: calendarDaySchema.transform((day) => day.toString()),
      method: z.enum(paymentMethods).nullable(),
      removed: z.boolean(),
    }),
  ),
  deleted: z.boolean(),
});

export type OrderSnapshot = z.output<typeof orderSnapshotSchema>;

export type OrderChange = {
  readonly id: OrderChangeId;
  readonly orderId: OrderId;
  readonly kind: OrderChangeKind;
  readonly at: Temporal.Instant;
  readonly by: AccountId;
  // None before an order was placed
  readonly before: OrderSnapshot | undefined;
  readonly after: OrderSnapshot;
};

export function snapshot(order: Order): OrderSnapshot {
  return {
    customerId: order.customerId,
    orderedOn: order.orderedOn.toString(),
    deliveredOn: order.deliveredOn?.toString() ?? null,
    note: order.note ?? null,
    lines: order.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      paidOn: payment.paidOn.toString(),
      method: payment.method ?? null,
      removed: payment.removal !== undefined,
    })),
    deleted: order.status === "deleted",
  };
}

// The change that turned `before` into `after`; the after's audit says who and when
export function record(
  kind: OrderChangeKind,
  before: Order | undefined,
  after: Order,
): OrderChange {
  return {
    id: orderChangeIdSchema.parse(uuidv7()),
    orderId: after.id,
    kind,
    at: after.audit.updatedAt,
    by: after.audit.updatedBy,
    before: before === undefined ? undefined : snapshot(before),
    after: snapshot(after),
  };
}
