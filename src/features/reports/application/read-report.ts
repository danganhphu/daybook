import { Temporal } from "temporal-polyfill/implementation";

import type { BookSettingRepository } from "@/features/book-settings/domain/book-setting-repository";
import type { CustomerId } from "@/features/customers/domain/customer";
import type { CustomerKindId } from "@/features/customers/domain/customer-kind";
import type { ProductId } from "@/features/products/domain/product";
import { quietCutoff, type QuietAfterDays } from "@/features/reports/domain/gone-quiet";
import {
  bucketFor,
  bucketKey,
  bucketsOf,
  previousPeriod,
  type BucketKind,
  type ReportPeriod,
} from "@/features/reports/domain/report-period";
import { remaining, sum, zeroMoney, type Money } from "@/shared/domain/money";

import type {
  CustomerSales,
  KindSales,
  ProductSales,
  QuietCustomer,
  ReportQueries,
  Sales,
} from "./report-queries";

export type ReportRequest = {
  readonly period: ReportPeriod;
  readonly kindId?: CustomerKindId | undefined;
  readonly customerId?: CustomerId | undefined;
  readonly productId?: ProductId | undefined;
};

export type Ranking<Row> = {
  readonly rows: ReadonlyArray<Row>;
  // What the rows below the shown ones add up to
  readonly rest: Money;
};

export type BucketSales = {
  readonly start: Temporal.PlainDate;
  readonly sales: Money;
  readonly orders: number;
};

export type QuietList = {
  // The book's setting they were found by
  readonly afterDays: QuietAfterDays;
  readonly customers: ReadonlyArray<QuietCustomer>;
};

// A figure is undefined where it cannot be told or says nothing: money in and money owed under a product filter, a
// breakdown by the very thing filtered on, quiet customers for one customer or product
export type Report = {
  readonly period: ReportPeriod;
  readonly bucket: BucketKind;
  readonly sales: Sales;
  readonly previousSales: Money;
  // Every bucket of the period in order, the empty ones at zero
  readonly overTime: ReadonlyArray<BucketSales>;
  readonly received: Money | undefined;
  readonly owed: Money | undefined;
  readonly byKind: ReadonlyArray<KindSales> | undefined;
  readonly products: Ranking<ProductSales> | undefined;
  readonly customers: Ranking<CustomerSales> | undefined;
  readonly quiet: QuietList | undefined;
};

export const reportSizes = {
  // Products and customers ranked by sales
  ranked: 5,
  quiet: 10,
} as const;

export type ReportDeps = {
  readonly queries: ReportQueries;
  readonly settings: BookSettingRepository;
  readonly today: () => Temporal.PlainDate;
};

function ranking<Row extends { readonly sales: Money }>(
  rows: ReadonlyArray<Row>,
  total: Money,
): Ranking<Row> {
  return { rows, rest: remaining(total, sum(rows.map((row) => row.sales))) };
}

async function quietList(
  deps: ReportDeps,
  today: Temporal.PlainDate,
  kindId: CustomerKindId | undefined,
): Promise<QuietList> {
  const { quietAfterDays } = await deps.settings.get();
  const customers = await deps.queries.quietCustomers(
    quietCutoff(today, quietAfterDays),
    kindId,
    reportSizes.quiet,
  );

  return { afterDays: quietAfterDays, customers };
}

export async function readReport(deps: ReportDeps, request: ReportRequest): Promise<Report> {
  const { queries } = deps;
  const today = deps.today();
  const { period, kindId, customerId, productId } = request;
  const filter = { from: period.from, to: period.to, kindId, customerId, productId };
  const previous = previousPeriod(period);
  const bucket = bucketFor(period);
  const byAccount = productId === undefined;
  // What is owed at the period's end, or now if the period has not ended
  const end = Temporal.PlainDate.compare(period.to, today) > 0 ? today : period.to;
  const skipped = Promise.resolve(undefined);

  const [sales, previousSales, overTime, received, owed, byKind, products, customers, quiet] =
    await Promise.all([
      queries.sales(filter),
      queries.sales({ ...filter, from: previous.from, to: previous.to }),
      queries.salesOverTime(filter, bucket),
      byAccount
        ? queries.received({ from: period.from, to: period.to, kindId, customerId })
        : skipped,
      byAccount ? queries.owedAt(end, { kindId, customerId }) : skipped,
      kindId === undefined && customerId === undefined ? queries.salesByKind(filter) : skipped,
      productId === undefined ? queries.topProducts(filter, reportSizes.ranked) : skipped,
      customerId === undefined ? queries.topCustomers(filter, reportSizes.ranked) : skipped,
      customerId === undefined && productId === undefined
        ? quietList(deps, today, kindId)
        : skipped,
    ]);
  const inBuckets = new Map(overTime.map((point) => [point.bucket, point]));

  return {
    period,
    bucket,
    sales,
    previousSales: previousSales.sales,
    overTime: bucketsOf(period, bucket).map((start) => {
      const found = inBuckets.get(bucketKey(start, bucket));
      return { start, sales: found?.sales ?? zeroMoney, orders: found?.orders ?? 0 };
    }),
    received,
    owed,
    byKind,
    products: products === undefined ? undefined : ranking(products, sales.sales),
    customers: customers === undefined ? undefined : ranking(customers, sales.sales),
    quiet,
  };
}
