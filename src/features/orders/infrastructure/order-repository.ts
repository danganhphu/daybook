import { eq, inArray, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

import type { Order } from "@/features/orders/domain/order";
import type { OrderRepository } from "@/features/orders/domain/order-repository";
import type { Database } from "@/shared/infrastructure/d1/database";
import { d1MaxBoundParameters } from "@/shared/infrastructure/d1/limits";

import { orderLineTable } from "./order-line.table";
import { toOrder } from "./order-mapping";
import { paymentTable } from "./payment.table";
import { salesOrderTable } from "./sales-order.table";

export function createOrderRepository(db: Database): OrderRepository {
  // The orders a condition picks, whole: three reads in one round trip, the lines and payments found through the same
  // condition rather than a list of ids, which D1 caps at 100 bound parameters
  async function ordersWhere(condition: SQL): Promise<ReadonlyArray<Order>> {
    const ids = db.select({ id: salesOrderTable.id }).from(salesOrderTable).where(condition);
    const [orders, lines, payments] = await db.batch([
      db.select().from(salesOrderTable).where(condition),
      db.select().from(orderLineTable).where(inArray(orderLineTable.orderId, ids)),
      db.select().from(paymentTable).where(inArray(paymentTable.orderId, ids)),
    ]);
    const linesOf = Map.groupBy(lines, (line) => line.orderId);
    const paymentsOf = Map.groupBy(payments, (payment) => payment.orderId);

    return orders.map((order) =>
      toOrder(order, linesOf.get(order.id) ?? [], paymentsOf.get(order.id) ?? []),
    );
  }

  // One round trip per chunk of values, under D1's bound-parameter limit
  async function ordersIn(column: SQLiteColumn, values: ReadonlyArray<string>) {
    const orders: Order[] = [];
    for (let start = 0; start < values.length; start += d1MaxBoundParameters) {
      const chunk = values.slice(start, start + d1MaxBoundParameters);
      // oxlint-disable-next-line no-await-in-loop -- one chunk per round trip, under D1's bound-parameter limit
      const found = await ordersWhere(inArray(column, chunk));
      orders.push(...found);
    }

    return orders;
  }

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

    getMany(ids) {
      return ordersIn(salesOrderTable.id, ids);
    },

    forCustomer(customerId) {
      return ordersWhere(eq(salesOrderTable.customerId, customerId));
    },

    forCustomers(customerIds) {
      return ordersIn(salesOrderTable.customerId, customerIds);
    },

    withProduct(productId) {
      return ordersWhere(
        inArray(
          salesOrderTable.id,
          db
            .select({ id: orderLineTable.orderId })
            .from(orderLineTable)
            .where(eq(orderLineTable.productId, productId)),
        ),
      );
    },
  };
}
