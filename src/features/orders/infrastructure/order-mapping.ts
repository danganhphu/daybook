import { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import { captureIdSchema } from "@/features/capture/domain/capture";
import { customerIdSchema } from "@/features/customers/domain/customer";
import {
  orderIdSchema,
  orderLimits,
  paymentIdSchema,
  paymentMethods,
  quantitySchema,
  type Order,
  type OrderLine,
  type Payment,
} from "@/features/orders/domain/order";
import { productIdSchema } from "@/features/products/domain/product";
import { accountIdSchema } from "@/shared/domain/account-id";
import { calendarDaySchema } from "@/shared/domain/calendar-day";
import { moneySchema } from "@/shared/domain/money-schema";
import { optionalTextSchema } from "@/shared/domain/short-text";
import {
  toAudit,
  toAuditRow,
  toDeletion,
  toDeletionRow,
} from "@/shared/infrastructure/d1/audit-mapping";

import type { orderLineTable } from "./order-line.table";
import type { paymentTable } from "./payment.table";
import type { salesOrderTable } from "./sales-order.table";

type OrderRow = typeof salesOrderTable.$inferSelect;
type LineRow = typeof orderLineTable.$inferSelect;
type PaymentRow = typeof paymentTable.$inferSelect;

const noteSchema = optionalTextSchema(orderLimits.note, "note");

const methodSchema = z.enum(paymentMethods);

function methodOf(method: string | null) {
  return method === null ? undefined : methodSchema.parse(method);
}

function toLine(row: LineRow): OrderLine {
  return {
    productId: productIdSchema.parse(row.productId),
    quantity: quantitySchema.parse(row.quantity),
    unitPrice: moneySchema.parse(row.unitPrice),
  };
}

function toPayment(row: PaymentRow): Payment {
  const removal = toDeletion(row);
  const method = methodOf(row.method);

  return {
    id: paymentIdSchema.parse(row.id),
    amount: moneySchema.parse(row.amount),
    paidOn: calendarDaySchema.parse(row.paidOn),
    ...(method === undefined ? {} : { method }),
    note: noteSchema.parse(row.note ?? undefined),
    recordedAt: Temporal.Instant.fromEpochMilliseconds(row.recordedAt),
    recordedBy: accountIdSchema.parse(row.recordedBy),
    ...(removal === undefined ? {} : { removal }),
  };
}

// The order row with its lines (any order; sorted here) and its payments
export function toOrder(
  row: OrderRow,
  lines: ReadonlyArray<LineRow>,
  payments: ReadonlyArray<PaymentRow>,
): Order {
  const deliveredOn =
    row.deliveredOn === null ? undefined : calendarDaySchema.parse(row.deliveredOn);
  const captureId = row.captureId === null ? undefined : captureIdSchema.parse(row.captureId);
  const fields = {
    id: orderIdSchema.parse(row.id),
    customerId: customerIdSchema.parse(row.customerId),
    orderedOn: calendarDaySchema.parse(row.orderedOn),
    ...(deliveredOn === undefined ? {} : { deliveredOn }),
    note: noteSchema.parse(row.note ?? undefined),
    ...(captureId === undefined ? {} : { captureId }),
    lines: lines.toSorted((a, b) => a.position - b.position).map(toLine),
    payments: payments.toSorted((a, b) => a.recordedAt - b.recordedAt).map(toPayment),
    audit: toAudit(row),
  };
  const deletion = toDeletion(row);

  return deletion === undefined
    ? { ...fields, status: "live" }
    : {
        ...fields,
        status: "deleted",
        deletion,
        deletedWith: row.deletedWith === null ? undefined : customerIdSchema.parse(row.deletedWith),
      };
}

export function toOrderRow(order: Order): OrderRow {
  return {
    id: order.id,
    customerId: order.customerId,
    orderedOn: order.orderedOn.toString(),
    deliveredOn: order.deliveredOn?.toString() ?? null,
    note: order.note ?? null,
    captureId: order.captureId ?? null,
    ...toAuditRow(order.audit),
    ...toDeletionRow(order.status === "deleted" ? order.deletion : undefined),
    deletedWith: order.status === "deleted" ? (order.deletedWith ?? null) : null,
  };
}

export function toLineRows(order: Order): ReadonlyArray<LineRow> {
  return order.lines.map((line, position) => ({
    orderId: order.id,
    position,
    productId: line.productId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
  }));
}

export function toPaymentRow(orderId: string, payment: Payment): PaymentRow {
  return {
    id: payment.id,
    orderId,
    amount: payment.amount,
    paidOn: payment.paidOn.toString(),
    method: payment.method ?? null,
    note: payment.note ?? null,
    recordedAt: payment.recordedAt.epochMilliseconds,
    recordedBy: payment.recordedBy,
    ...toDeletionRow(payment.removal),
  };
}
