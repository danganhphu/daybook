import type { Temporal } from "temporal-polyfill/implementation";

import type { CaptureId } from "@/features/capture/domain/capture";
import type { CustomerId } from "@/features/customers/domain/customer";
import type { CustomerKindId } from "@/features/customers/domain/customer-kind";
import type { OrderId } from "@/features/orders/domain/order";
import type { OrderChange } from "@/features/orders/domain/order-change";
import type { ProductId } from "@/features/products/domain/product";
import type { Money } from "@/shared/domain/money";

// Read models: what the screens list and sum, computed in SQL so a screen is one or two queries, well inside D1's 50
// per request on the free plan

export type OrderFilter = {
  // Both days included
  readonly from: Temporal.PlainDate;
  readonly to: Temporal.PlainDate;
  readonly customerId?: CustomerId | undefined;
  readonly kindId?: CustomerKindId | undefined;
  readonly productId?: ProductId | undefined;
  readonly delivery?: "delivered" | "undelivered" | undefined;
  readonly payment?: "paid" | "owed" | undefined;
};

export type OrderRow = {
  readonly id: OrderId;
  readonly customerId: CustomerId;
  readonly customerName: string;
  readonly customerArea: string | undefined;
  readonly orderedOn: Temporal.PlainDate;
  readonly deliveredOn: Temporal.PlainDate | undefined;
  // The products in line order, for a row to say what was sold
  readonly productNames: ReadonlyArray<string>;
  readonly total: Money;
  readonly paid: Money;
};

export type OrderTotals = {
  readonly count: number;
  readonly total: Money;
  readonly paid: Money;
  // Summed per order, so an order paid over its total never hides another's debt
  readonly owed: Money;
};

export type CustomerAccount = {
  readonly orderCount: number;
  readonly total: Money;
  readonly owed: Money;
  readonly lastOrderedOn: Temporal.PlainDate | undefined;
};

// A live order a message became, as the message shows it
export type OrderMadeFrom = {
  readonly captureId: CaptureId;
  readonly orderId: OrderId;
  readonly customerName: string;
  // In line order
  readonly lines: ReadonlyArray<{
    readonly productName: string;
    readonly quantity: number;
    readonly unitPrice: Money;
  }>;
  readonly total: Money;
};

export type OrderQueries = {
  // Newest first, at most `limit`
  list(filter: OrderFilter, limit: number): Promise<ReadonlyArray<OrderRow>>;
  totals(filter: OrderFilter): Promise<OrderTotals>;
  // What each customer owes across their live orders; customers who owe nothing are left out
  owedByCustomer(): Promise<ReadonlyMap<CustomerId, Money>>;
  customerAccount(customerId: CustomerId): Promise<CustomerAccount>;
  // The latest price of each product, from this customer's live orders first, else from anyone's
  lastPrices(
    productIds: ReadonlyArray<ProductId>,
    customerId: CustomerId | undefined,
  ): Promise<ReadonlyMap<ProductId, Money>>;
  // Oldest first
  history(orderId: OrderId): Promise<ReadonlyArray<OrderChange>>;
  madeFrom(captureIds: ReadonlyArray<CaptureId>): Promise<ReadonlyArray<OrderMadeFrom>>;
};
