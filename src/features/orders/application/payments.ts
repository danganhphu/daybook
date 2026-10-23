import * as Orders from "@/features/orders/domain/order";
import type { OrderId, PaymentDetails, PaymentId } from "@/features/orders/domain/order";
import type { RecordChange } from "@/shared/application/record-change";
import { ok } from "@/shared/domain/result";

import { changeOrder } from "./change-order";
import type { OrderDeps } from "./order-deps";

export type AddPaymentInput = RecordChange<OrderId> & { readonly payment: PaymentDetails };

// Never more than is still owed
export function addPayment(deps: OrderDeps, input: AddPaymentInput) {
  return changeOrder(deps, input, "payment_added", (order, at) => {
    const added = Orders.addPayment(order, input.payment, input.by, at);

    return added.ok ? ok(added.value.order) : added;
  });
}

export type RemovePaymentInput = RecordChange<OrderId> & { readonly paymentId: PaymentId };

// The payment stays on record, marked removed with who and when
export function removePayment(deps: OrderDeps, input: RemovePaymentInput) {
  return changeOrder(deps, input, "payment_removed", (order, at) =>
    Orders.removePayment(order, input.paymentId, input.by, at),
  );
}
