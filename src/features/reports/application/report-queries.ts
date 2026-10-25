import type { Temporal } from "temporal-polyfill/implementation";

import type { CustomerId } from "@/features/customers/domain/customer";
import type { CustomerKindId } from "@/features/customers/domain/customer-kind";
import type { ProductId } from "@/features/products/domain/product";
import type { BucketKind } from "@/features/reports/domain/report-period";
import type { Money } from "@/shared/domain/money";

// What reports sum, each one aggregate query over live orders, so a report stays a handful of the 50 queries D1 allows
// a request on the free plan

export type ReportFilter = {
  // Both days included
  readonly from: Temporal.PlainDate;
  readonly to: Temporal.PlainDate;
  readonly customerId?: CustomerId | undefined;
  readonly kindId?: CustomerKindId | undefined;
  readonly productId?: ProductId | undefined;
};

// A payment pays an order, not a product, so money in and money owed are never split by product
export type AccountFilter = Omit<ReportFilter, "productId">;

export type Sales = {
  // The lines of orders placed in the period, by the day each was placed
  readonly sales: Money;
  readonly orders: number;
  // Only meaningful for one product
  readonly units: number;
};

export type SalesInBucket = Sales & {
  // The bucket's first day, or YYYY-MM for a month (report-period.ts, bucketKey)
  readonly bucket: string;
};

export type KindSales = {
  // Undefined for customers with no kind
  readonly kindId: CustomerKindId | undefined;
  readonly kindName: string | undefined;
  readonly sales: Money;
};

export type ProductSales = {
  readonly productId: ProductId;
  readonly name: string;
  readonly sales: Money;
  readonly units: number;
};

export type CustomerSales = {
  readonly customerId: CustomerId;
  readonly name: string;
  readonly area: string | undefined;
  readonly sales: Money;
};

export type QuietCustomer = {
  readonly customerId: CustomerId;
  readonly name: string;
  readonly area: string | undefined;
  readonly lastOrderedOn: Temporal.PlainDate;
};

export type ReportQueries = {
  sales(filter: ReportFilter): Promise<Sales>;
  // Buckets with no sales are left out
  salesOverTime(filter: ReportFilter, bucket: BucketKind): Promise<ReadonlyArray<SalesInBucket>>;
  // Payments made in the period, whenever their orders were placed
  received(filter: AccountFilter): Promise<Money>;
  // What live orders placed by that day still owed at its end
  owedAt(day: Temporal.PlainDate, filter: Omit<AccountFilter, "from" | "to">): Promise<Money>;
  // Biggest first
  salesByKind(filter: ReportFilter): Promise<ReadonlyArray<KindSales>>;
  topProducts(filter: ReportFilter, limit: number): Promise<ReadonlyArray<ProductSales>>;
  topCustomers(filter: ReportFilter, limit: number): Promise<ReadonlyArray<CustomerSales>>;
  // Visible customers whose last live order was on that day or before, the most recent first
  quietCustomers(
    lastOrderBy: Temporal.PlainDate,
    kindId: CustomerKindId | undefined,
    limit: number,
  ): Promise<ReadonlyArray<QuietCustomer>>;
};
