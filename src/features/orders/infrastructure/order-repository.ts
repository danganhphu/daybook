import { eq } from "drizzle-orm";

import type { OrderRepository } from "@/features/orders/domain/order-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { orderLineTable } from "./order-line.table";
import { toOrder } from "./order-mapping";
import { paymentTable } from "./payment.table";
import { salesOrderTable } from "./sales-order.table";

export function createOrderRepository(db: Database): OrderRepository {
  return {
    // Three reads in one round trip
    async get(id) {
      const [orders, lines, payments] = await db.batch([
        db.select().from(salesOrderTable).where(eq(salesOrderTable.id, id)).limit(1),
        db.select().from(orderLineTable).where(eq(orderLineTable.orderId, id)),
        db.select().from(paymentTable).where(eq(paymentTable.orderId, id)),
      ]);
      const [order] = orders;

      return order === undefined ? undefined : toOrder(order, lines, payments);
    },
  };
}
