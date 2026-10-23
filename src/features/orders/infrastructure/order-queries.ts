import {
  and,
  asc,
  between,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  max,
  sql,
  type SQL,
} from "drizzle-orm";
import { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import { customerIdSchema } from "@/features/customers/domain/customer";
import { customerTable } from "@/features/customers/infrastructure/customer.table";
import type { OrderFilter, OrderQueries } from "@/features/orders/application/order-queries";
import { orderIdSchema } from "@/features/orders/domain/order";
import {
  orderChangeIdSchema,
  orderChangeKinds,
  orderSnapshotSchema,
} from "@/features/orders/domain/order-change";
import { productIdSchema } from "@/features/products/domain/product";
import { productTable } from "@/features/products/infrastructure/product.table";
import { accountIdSchema } from "@/shared/domain/account-id";
import { calendarDaySchema } from "@/shared/domain/calendar-day";
import { moneySchema } from "@/shared/domain/money";
import type { Database } from "@/shared/infrastructure/d1/database";

import { orderChangeTable } from "./order-change.table";
import { orderLineTable } from "./order-line.table";
import { paymentTable } from "./payment.table";
import { salesOrderTable } from "./sales-order.table";

// Per order, computed where the order is read: the total of its lines and what its live payments add up to
const orderTotal = sql<number>`(select coalesce(sum(${orderLineTable.quantity} * ${orderLineTable.unitPrice}), 0) from ${orderLineTable} where ${orderLineTable.orderId} = ${salesOrderTable.id})`;
const orderPaid = sql<number>`(select coalesce(sum(${paymentTable.amount}), 0) from ${paymentTable} where ${paymentTable.orderId} = ${salesOrderTable.id} and ${paymentTable.deletedAt} is null)`;
const orderOwed = sql<number>`max(${orderTotal} - ${orderPaid}, 0)`;

// Product names in line order, joined by the unit separator, which no typed name holds
const nameSeparator = "\u001F";
const productNames = sql<
  string | null
>`(select group_concat(name, char(31)) from (select ${productTable.name} as name from ${orderLineTable} join ${productTable} on ${productTable.id} = ${orderLineTable.productId} where ${orderLineTable.orderId} = ${salesOrderTable.id} order by ${orderLineTable.position}))`;

const live = isNull(salesOrderTable.deletedAt);

function matching(filter: OrderFilter): SQL | undefined {
  return and(
    live,
    between(salesOrderTable.orderedOn, filter.from.toString(), filter.to.toString()),
    filter.customerId === undefined ? undefined : eq(salesOrderTable.customerId, filter.customerId),
    filter.kindId === undefined ? undefined : eq(customerTable.kindId, filter.kindId),
    filter.productId === undefined
      ? undefined
      : sql`exists (select 1 from ${orderLineTable} where ${orderLineTable.orderId} = ${salesOrderTable.id} and ${orderLineTable.productId} = ${filter.productId})`,
    filter.delivery === "delivered" ? isNotNull(salesOrderTable.deliveredOn) : undefined,
    filter.delivery === "undelivered" ? isNull(salesOrderTable.deliveredOn) : undefined,
    filter.payment === "owed" ? sql`${orderTotal} > ${orderPaid}` : undefined,
    filter.payment === "paid" ? sql`${orderTotal} <= ${orderPaid}` : undefined,
  );
}

const money = (value: number | null) => moneySchema.parse(value ?? 0);

const changeKindSchema = z.enum(orderChangeKinds);

export function createOrderQueries(db: Database): OrderQueries {
  return {
    async list(filter, limit) {
      const rows = await db
        .select({
          id: salesOrderTable.id,
          customerId: salesOrderTable.customerId,
          customerName: customerTable.name,
          customerArea: customerTable.area,
          orderedOn: salesOrderTable.orderedOn,
          deliveredOn: salesOrderTable.deliveredOn,
          productNames,
          total: orderTotal,
          paid: orderPaid,
        })
        .from(salesOrderTable)
        .innerJoin(customerTable, eq(customerTable.id, salesOrderTable.customerId))
        .where(matching(filter))
        .orderBy(desc(salesOrderTable.orderedOn), desc(salesOrderTable.id))
        .limit(limit);

      return rows.map((row) => ({
        id: orderIdSchema.parse(row.id),
        customerId: customerIdSchema.parse(row.customerId),
        customerName: row.customerName,
        customerArea: row.customerArea ?? undefined,
        orderedOn: calendarDaySchema.parse(row.orderedOn),
        deliveredOn:
          row.deliveredOn === null ? undefined : calendarDaySchema.parse(row.deliveredOn),
        productNames: row.productNames === null ? [] : row.productNames.split(nameSeparator),
        total: money(row.total),
        paid: money(row.paid),
      }));
    },

    async totals(filter) {
      const [row] = await db
        .select({
          count: count(),
          total: sql<number>`coalesce(sum(${orderTotal}), 0)`,
          paid: sql<number>`coalesce(sum(${orderPaid}), 0)`,
          owed: sql<number>`coalesce(sum(${orderOwed}), 0)`,
        })
        .from(salesOrderTable)
        .innerJoin(customerTable, eq(customerTable.id, salesOrderTable.customerId))
        .where(matching(filter));

      return {
        count: row?.count ?? 0,
        total: money(row?.total ?? 0),
        paid: money(row?.paid ?? 0),
        owed: money(row?.owed ?? 0),
      };
    },

    async owedByCustomer() {
      const rows = await db
        .select({
          customerId: salesOrderTable.customerId,
          owed: sql<number>`sum(${orderOwed})`.as("owed"),
        })
        .from(salesOrderTable)
        .where(live)
        .groupBy(salesOrderTable.customerId)
        .having(sql`sum(${orderOwed}) > 0`);

      return new Map(rows.map((row) => [customerIdSchema.parse(row.customerId), money(row.owed)]));
    },

    async customerAccount(customerId) {
      const [row] = await db
        .select({
          orderCount: count(),
          total: sql<number>`coalesce(sum(${orderTotal}), 0)`,
          owed: sql<number>`coalesce(sum(${orderOwed}), 0)`,
          lastOrderedOn: max(salesOrderTable.orderedOn),
        })
        .from(salesOrderTable)
        .where(and(live, eq(salesOrderTable.customerId, customerId)));

      return {
        orderCount: row?.orderCount ?? 0,
        total: money(row?.total ?? 0),
        owed: money(row?.owed ?? 0),
        lastOrderedOn:
          row?.lastOrderedOn === null || row?.lastOrderedOn === undefined
            ? undefined
            : calendarDaySchema.parse(row.lastOrderedOn),
      };
    },

    async lastPrices(productIds, customerId) {
      if (productIds.length === 0) {
        return new Map();
      }
      const ranked = db
        .select({
          productId: orderLineTable.productId,
          unitPrice: orderLineTable.unitPrice,
          rank: sql<number>`row_number() over (partition by ${orderLineTable.productId} order by (${salesOrderTable.customerId} = ${customerId ?? ""}) desc, ${salesOrderTable.orderedOn} desc, ${salesOrderTable.createdAt} desc)`.as(
            "rank",
          ),
        })
        .from(orderLineTable)
        .innerJoin(salesOrderTable, eq(salesOrderTable.id, orderLineTable.orderId))
        .where(and(live, inArray(orderLineTable.productId, [...productIds])))
        .as("ranked");
      const rows = await db
        .select({ productId: ranked.productId, unitPrice: ranked.unitPrice })
        .from(ranked)
        .where(eq(ranked.rank, 1));

      return new Map(
        rows.map((row) => [productIdSchema.parse(row.productId), money(row.unitPrice)]),
      );
    },

    async history(orderId) {
      const rows = await db
        .select()
        .from(orderChangeTable)
        .where(eq(orderChangeTable.orderId, orderId))
        .orderBy(asc(orderChangeTable.changedAt), asc(orderChangeTable.id));

      return rows.map((row) => ({
        id: orderChangeIdSchema.parse(row.id),
        orderId: orderIdSchema.parse(row.orderId),
        kind: changeKindSchema.parse(row.kind),
        at: Temporal.Instant.fromEpochMilliseconds(row.changedAt),
        by: accountIdSchema.parse(row.changedBy),
        before: row.before === null ? undefined : orderSnapshotSchema.parse(JSON.parse(row.before)),
        after: orderSnapshotSchema.parse(JSON.parse(row.after)),
      }));
    },
  };
}
