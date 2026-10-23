import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { orderLimits } from "@/features/orders/domain/order";
import { productTable } from "@/features/products/infrastructure/product.table";
import { moneyMax } from "@/shared/domain/money";
import { sqlNumber } from "@/shared/infrastructure/d1/sql-literals";

import { salesOrderTable } from "./sales-order.table";

// Part of the order: replaced whole when the order is revised, under the order's version, so no audit of its own
export const orderLineTable = sqliteTable(
  "order_line",
  {
    orderId: text("order_id")
      .notNull()
      .references(() => salesOrderTable.id),
    position: integer("position").notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => productTable.id),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.orderId, table.position] }),
    check(
      "order_line_position_range",
      sql`${table.position} between 0 and ${sqlNumber(orderLimits.lines - 1)}`,
    ),
    check(
      "order_line_quantity_range",
      sql`${table.quantity} between 1 and ${sqlNumber(orderLimits.quantity)}`,
    ),
    check("order_line_price_range", sql`${table.unitPrice} between 0 and ${sqlNumber(moneyMax)}`),
    index("order_line_by_product").on(table.productId),
  ],
);
