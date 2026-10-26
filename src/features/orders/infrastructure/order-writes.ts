import { eq, getTableColumns } from "drizzle-orm";

import type { OrderWrites } from "@/features/orders/application/order-writes";
import type { Order } from "@/features/orders/domain/order";
import type { OrderChange } from "@/features/orders/domain/order-change";
import type { Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";
import { d1MaxBoundParameters } from "@/shared/infrastructure/d1/limits";

import { orderChangeTable } from "./order-change.table";
import { orderLineTable } from "./order-line.table";
import { toLineRows, toOrderRow, toPaymentRow } from "./order-mapping";
import { paymentTable } from "./payment.table";
import { salesOrderTable } from "./sales-order.table";

const linesPerInsert = Math.floor(
  d1MaxBoundParameters / Object.keys(getTableColumns(orderLineTable)).length,
);

// The only changes that rewrite an order's lines; every other one leaves them as they are
const changesToLines: ReadonlySet<OrderChange["kind"]> = new Set(["revised", "product_merged"]);

export function createOrderWrites(db: Database, batch: Batch): OrderWrites {
  function enlistChange(change: OrderChange) {
    batch.enlist(
      db.insert(orderChangeTable).values({
        id: change.id,
        orderId: change.orderId,
        kind: change.kind,
        changedAt: change.at.epochMilliseconds,
        changedBy: change.by,
        before: change.before === undefined ? null : JSON.stringify(change.before),
        after: JSON.stringify(change.after),
      }),
    );
  }

  function enlistLines(order: Order) {
    const lines = toLineRows(order);
    for (let start = 0; start < lines.length; start += linesPerInsert) {
      batch.enlist(db.insert(orderLineTable).values(lines.slice(start, start + linesPerInsert)));
    }
  }

  // Only what changed, judged against the order as the log saw it before: a payment it did not have is inserted, one
  // it had that is now removed gets its removal - the only update the payment trigger allows
  function enlistPayments(order: Order, change: OrderChange) {
    const before = new Map(change.before?.payments.map((payment) => [payment.id, payment]));
    for (const payment of order.payments) {
      const was = before.get(payment.id);
      const row = toPaymentRow(order.id, payment);
      if (was === undefined) {
        batch.enlist(db.insert(paymentTable).values(row));
      } else if (!was.removed && payment.removal !== undefined) {
        batch.enlist(
          db
            .update(paymentTable)
            .set({ deletedAt: row.deletedAt, deletedBy: row.deletedBy })
            .where(eq(paymentTable.id, payment.id)),
        );
      }
    }
  }

  return {
    // The order row first: lines and payments point at it
    add(order, change) {
      batch.enlist(db.insert(salesOrderTable).values(toOrderRow(order)));
      enlistLines(order);
      enlistPayments(order, change);
      enlistChange(change);
    },

    // The order row first, so a stale version aborts the batch before anything else is written. The lines are
    // replaced whole only when the change rewrites them.
    update(order, change) {
      const {
        id: _id,
        createdAt: _createdAt,
        createdBy: _createdBy,
        ...changes
      } = toOrderRow(order);
      batch.enlist(db.update(salesOrderTable).set(changes).where(eq(salesOrderTable.id, order.id)));
      if (changesToLines.has(change.kind)) {
        batch.enlist(db.delete(orderLineTable).where(eq(orderLineTable.orderId, order.id)));
        enlistLines(order);
      }
      enlistPayments(order, change);
      enlistChange(change);
    },
  };
}
