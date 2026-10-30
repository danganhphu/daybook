import {
  and,
  asc,
  between,
  countDistinct,
  desc,
  eq,
  isNull,
  lte,
  max,
  sql,
  type SQL,
} from "drizzle-orm";

import { customerIdSchema } from "@/features/customers/domain/customer";
import { customerKindIdSchema } from "@/features/customers/domain/customer-kind";
import { customerKindTable } from "@/features/customers/infrastructure/customer-kind.table";
import { customerTable } from "@/features/customers/infrastructure/customer.table";
import { orderLineTable } from "@/features/orders/infrastructure/order-line.table";
import { paymentTable } from "@/features/orders/infrastructure/payment.table";
import { salesOrderTable } from "@/features/orders/infrastructure/sales-order.table";
import { productIdSchema } from "@/features/products/domain/product";
import { productTable } from "@/features/products/infrastructure/product.table";
import type {
  AccountFilter,
  ReportFilter,
  ReportQueries,
} from "@/features/reports/application/report-queries";
import type { BucketKind } from "@/features/reports/domain/report-period";
import { calendarDaySchema } from "@/shared/domain/calendar-day";
import { moneySchema } from "@/shared/domain/money-schema";
import type { Database } from "@/shared/infrastructure/d1/database";

// Sales are summed over order lines, so a product filter sums that product's lines rather than whole orders
const lineSales = sql<number>`coalesce(sum(${orderLineTable.quantity} * ${orderLineTable.unitPrice}), 0)`;
const lineUnits = sql<number>`coalesce(sum(${orderLineTable.quantity}), 0)`;
const orderCount = countDistinct(salesOrderTable.id);

// A bucket named as report-period.ts names it: the day, the Monday of its week ('weekday 0' moves to the Sunday on or
// after, six days back is that week's Monday), or YYYY-MM
const buckets = {
  day: sql<string>`${salesOrderTable.orderedOn}`,
  week: sql<string>`date(${salesOrderTable.orderedOn}, 'weekday 0', '-6 days')`,
  month: sql<string>`substr(${salesOrderTable.orderedOn}, 1, 7)`,
} as const satisfies Record<BucketKind, SQL<string>>;

const liveOrder = isNull(salesOrderTable.deletedAt);

function byAccount(filter: Pick<AccountFilter, "customerId" | "kindId">): SQL | undefined {
  return and(
    filter.customerId === undefined ? undefined : eq(salesOrderTable.customerId, filter.customerId),
    filter.kindId === undefined ? undefined : eq(customerTable.kindId, filter.kindId),
  );
}

function matchingLines(filter: ReportFilter): SQL | undefined {
  return and(
    liveOrder,
    between(salesOrderTable.orderedOn, filter.from.toString(), filter.to.toString()),
    byAccount(filter),
    filter.productId === undefined ? undefined : eq(orderLineTable.productId, filter.productId),
  );
}

const money = (value: number | null) => moneySchema.parse(value ?? 0);

export function createReportQueries(db: Database): ReportQueries {
  return {
    async sales(filter) {
      const [row] = await db
        .select({ sales: lineSales, orders: orderCount, units: lineUnits })
        .from(orderLineTable)
        .innerJoin(salesOrderTable, eq(salesOrderTable.id, orderLineTable.orderId))
        .innerJoin(customerTable, eq(customerTable.id, salesOrderTable.customerId))
        .where(matchingLines(filter));

      return { sales: money(row?.sales ?? 0), orders: row?.orders ?? 0, units: row?.units ?? 0 };
    },

    async salesOverTime(filter, bucket) {
      const rows = await db
        .select({
          bucket: buckets[bucket],
          sales: lineSales,
          orders: orderCount,
          units: lineUnits,
        })
        .from(orderLineTable)
        .innerJoin(salesOrderTable, eq(salesOrderTable.id, orderLineTable.orderId))
        .innerJoin(customerTable, eq(customerTable.id, salesOrderTable.customerId))
        .where(matchingLines(filter))
        .groupBy(buckets[bucket]);

      return rows.map((row) => ({
        bucket: row.bucket,
        sales: money(row.sales),
        orders: row.orders,
        units: row.units,
      }));
    },

    async received(filter) {
      const [row] = await db
        .select({ amount: sql<number>`coalesce(sum(${paymentTable.amount}), 0)` })
        .from(paymentTable)
        .innerJoin(salesOrderTable, eq(salesOrderTable.id, paymentTable.orderId))
        .innerJoin(customerTable, eq(customerTable.id, salesOrderTable.customerId))
        .where(
          and(
            isNull(paymentTable.deletedAt),
            liveOrder,
            between(paymentTable.paidOn, filter.from.toString(), filter.to.toString()),
            byAccount(filter),
          ),
        );

      return money(row?.amount ?? 0);
    },

    async owedAt(day, filter) {
      const end = day.toString();
      const total = sql<number>`(select coalesce(sum(${orderLineTable.quantity} * ${orderLineTable.unitPrice}), 0) from ${orderLineTable} where ${orderLineTable.orderId} = ${salesOrderTable.id})`;
      const paidBy = sql<number>`(select coalesce(sum(${paymentTable.amount}), 0) from ${paymentTable} where ${paymentTable.orderId} = ${salesOrderTable.id} and ${paymentTable.deletedAt} is null and ${paymentTable.paidOn} <= ${end})`;
      const [row] = await db
        .select({ owed: sql<number>`coalesce(sum(max(${total} - ${paidBy}, 0)), 0)` })
        .from(salesOrderTable)
        .innerJoin(customerTable, eq(customerTable.id, salesOrderTable.customerId))
        .where(and(liveOrder, lte(salesOrderTable.orderedOn, end), byAccount(filter)));

      return money(row?.owed ?? 0);
    },

    // A kind in the trash counts as none, as its customers read
    async salesByKind(filter) {
      const rows = await db
        .select({
          kindId: customerKindTable.id,
          kindName: customerKindTable.name,
          sales: lineSales,
        })
        .from(orderLineTable)
        .innerJoin(salesOrderTable, eq(salesOrderTable.id, orderLineTable.orderId))
        .innerJoin(customerTable, eq(customerTable.id, salesOrderTable.customerId))
        .leftJoin(
          customerKindTable,
          and(eq(customerKindTable.id, customerTable.kindId), isNull(customerKindTable.deletedAt)),
        )
        .where(matchingLines(filter))
        .groupBy(customerKindTable.id, customerKindTable.name)
        .orderBy(desc(lineSales), asc(customerKindTable.position));

      return rows.map((row) => ({
        kindId: row.kindId === null ? undefined : customerKindIdSchema.parse(row.kindId),
        kindName: row.kindName ?? undefined,
        sales: money(row.sales),
      }));
    },

    async topProducts(filter, limit) {
      const rows = await db
        .select({
          productId: orderLineTable.productId,
          name: productTable.name,
          sales: lineSales,
          units: lineUnits,
        })
        .from(orderLineTable)
        .innerJoin(salesOrderTable, eq(salesOrderTable.id, orderLineTable.orderId))
        .innerJoin(customerTable, eq(customerTable.id, salesOrderTable.customerId))
        .innerJoin(productTable, eq(productTable.id, orderLineTable.productId))
        .where(matchingLines(filter))
        .groupBy(orderLineTable.productId, productTable.name)
        .orderBy(desc(lineSales), asc(productTable.searchName))
        .limit(limit);

      return rows.map((row) => ({
        productId: productIdSchema.parse(row.productId),
        name: row.name,
        sales: money(row.sales),
        units: row.units,
      }));
    },

    async topCustomers(filter, limit) {
      const rows = await db
        .select({
          customerId: salesOrderTable.customerId,
          name: customerTable.name,
          area: customerTable.area,
          sales: lineSales,
        })
        .from(orderLineTable)
        .innerJoin(salesOrderTable, eq(salesOrderTable.id, orderLineTable.orderId))
        .innerJoin(customerTable, eq(customerTable.id, salesOrderTable.customerId))
        .where(matchingLines(filter))
        .groupBy(salesOrderTable.customerId, customerTable.name, customerTable.area)
        .orderBy(desc(lineSales), asc(customerTable.searchName))
        .limit(limit);

      return rows.map((row) => ({
        customerId: customerIdSchema.parse(row.customerId),
        name: row.name,
        area: row.area ?? undefined,
        sales: money(row.sales),
      }));
    },

    async quietCustomers(lastOrderBy, kindId, limit) {
      const lastOrder = max(salesOrderTable.orderedOn);
      const rows = await db
        .select({
          customerId: customerTable.id,
          name: customerTable.name,
          area: customerTable.area,
          lastOrderedOn: lastOrder,
        })
        .from(salesOrderTable)
        .innerJoin(customerTable, eq(customerTable.id, salesOrderTable.customerId))
        .where(
          and(
            liveOrder,
            isNull(customerTable.archivedAt),
            kindId === undefined ? undefined : eq(customerTable.kindId, kindId),
          ),
        )
        .groupBy(customerTable.id, customerTable.name, customerTable.area)
        .having(lte(lastOrder, lastOrderBy.toString()))
        .orderBy(desc(lastOrder), asc(customerTable.searchName))
        .limit(limit);

      return rows.map((row) => ({
        customerId: customerIdSchema.parse(row.customerId),
        name: row.name,
        area: row.area ?? undefined,
        lastOrderedOn: calendarDaySchema.parse(row.lastOrderedOn),
      }));
    },
  };
}
