import type { Temporal } from "temporal-polyfill/implementation";

import type { CaptureId } from "@/features/capture/domain/capture";
import type { CustomerId } from "@/features/customers/domain/customer";
import type { Quantity } from "@/features/orders/domain/order";
import type { ProductId, ProductName } from "@/features/products/domain/product";
import type { Money } from "@/shared/domain/money";

// An order as the form sends it: each line names a product already known, or a new one by name. Only a reading gives
// a total, when the amount a message wrote does not divide by its quantity (Orders.totalFits).
export type LineInput = {
  readonly product: { readonly id: ProductId } | { readonly name: ProductName };
  readonly quantity: Quantity;
  readonly unitPrice: Money;
  readonly total?: Money | undefined;
};

export type OrderInput = {
  readonly customerId: CustomerId;
  readonly orderedOn: Temporal.PlainDate;
  readonly lines: ReadonlyArray<LineInput>;
  readonly note: string | undefined;
  readonly captureId?: CaptureId;
};
