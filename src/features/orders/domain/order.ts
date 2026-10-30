import { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { captureIdSchema } from "@/features/capture/domain/capture";
import { customerIdSchema, type CustomerId } from "@/features/customers/domain/customer";
import { productIdSchema, type ProductId } from "@/features/products/domain/product";
import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";
import type { Audit, Deletion } from "@/shared/domain/audit";
import { moneyMax, remaining, sum, type Money } from "@/shared/domain/money";
import { moneySchema } from "@/shared/domain/money-schema";
import { err, ok, type Result } from "@/shared/domain/result";
import { optionalTextSchema } from "@/shared/domain/short-text";

// Read as a module: `import * as Orders`. An order is one aggregate: its lines and its payments change with it, under
// one version, so "paid never exceeds the total" is kept in one place and two people cannot break it at once.

export const orderIdSchema = z.uuid().brand<"OrderId">();

export type OrderId = z.infer<typeof orderIdSchema>;

export const paymentIdSchema = z.uuid().brand<"PaymentId">();

export type PaymentId = z.infer<typeof paymentIdSchema>;

export const orderLimits = { lines: 50, quantity: 100_000, note: 1000 } as const;

// Whole units for now; whether "1,5 hộp" happens is an open question in the plan
export const quantitySchema = z
  .number({ error: "Số lượng phải là số" })
  .int({ error: "Số lượng là số nguyên" })
  .min(1, { error: "Số lượng ít nhất là 1" })
  .max(orderLimits.quantity, { error: `Số lượng tối đa ${orderLimits.quantity}` })
  .brand<"Quantity">();

export type Quantity = z.infer<typeof quantitySchema>;

export const orderLineSchema = z.object({
  productId: productIdSchema,
  quantity: quantitySchema,
  unitPrice: moneySchema,
});

export type OrderLine = z.infer<typeof orderLineSchema>;

const orderNoteSchema = optionalTextSchema(
  orderLimits.note,
  `Ghi chú tối đa ${orderLimits.note} ký tự`,
);

// What the order form holds, once its products are known
export const orderDetailsSchema = z.object({
  customerId: customerIdSchema,
  orderedOn: z.instanceof(Temporal.PlainDate),
  lines: z
    .array(orderLineSchema)
    .min(1, { error: "Đơn cần ít nhất một sản phẩm" })
    .max(orderLimits.lines, { error: `Một đơn tối đa ${orderLimits.lines} sản phẩm` })
    .readonly(),
  note: orderNoteSchema,
  captureId: captureIdSchema.optional(),
});

export type OrderDetails = z.infer<typeof orderDetailsSchema>;

export const paymentMethods = ["cash", "transfer"] as const;

export type PaymentMethod = (typeof paymentMethods)[number];

export const paymentDetailsSchema = z.object({
  amount: moneySchema.refine((amount) => amount > 0, { error: "Số tiền phải lớn hơn 0" }),
  paidOn: z.instanceof(Temporal.PlainDate),
  method: z.enum(paymentMethods).optional(),
  note: orderNoteSchema,
});

export type PaymentDetails = z.infer<typeof paymentDetailsSchema>;

// A payment is never edited: a wrong one is removed, with who and when, and the right one added
export type Payment = PaymentDetails & {
  readonly id: PaymentId;
  readonly recordedAt: Temporal.Instant;
  readonly recordedBy: AccountId;
  readonly removal?: Deletion;
};

type OrderFields = Omit<OrderDetails, "lines"> & {
  readonly id: OrderId;
  readonly lines: ReadonlyArray<OrderLine>;
  readonly deliveredOn?: Temporal.PlainDate;
  readonly payments: ReadonlyArray<Payment>;
  readonly audit: Audit;
};

export type LiveOrder = OrderFields & { readonly status: "live" };

export type DeletedOrder = OrderFields & {
  readonly status: "deleted";
  readonly deletion: Deletion;
  // The customer deleted with it: it is in the trash under them, and comes back with them
  readonly deletedWith: CustomerId | undefined;
};

export type Order = LiveOrder | DeletedOrder;

export type OrderRefusal =
  | "order_deleted"
  | "order_not_deleted"
  | "order_deleted_with_customer"
  | "order_too_large"
  | "total_below_paid"
  | "payment_exceeds_owed"
  | "payment_not_found"
  | "delivered_before_ordered";

function lineAmount(line: OrderLine): number {
  return line.quantity * line.unitPrice;
}

// Computed from the lines every time, never stored, so it cannot drift from them
export function total(order: { readonly lines: ReadonlyArray<OrderLine> }): Money {
  return sum(order.lines.map((line) => moneySchema.parse(lineAmount(line))));
}

export function paid(order: Order): Money {
  return sum(
    order.payments.filter((payment) => payment.removal === undefined).map((p) => p.amount),
  );
}

export function owed(order: Order): Money {
  return remaining(total(order), paid(order));
}

export function isDelivered(order: Order): boolean {
  return order.deliveredOn !== undefined;
}

// Each line and the whole must stay countable in đồng
function fitsInMoney(lines: ReadonlyArray<OrderLine>): boolean {
  let running = 0;
  for (const line of lines) {
    running += lineAmount(line);
    if (lineAmount(line) > moneyMax || running > moneyMax) {
      return false;
    }
  }

  return true;
}

function deliveredInTime(orderedOn: Temporal.PlainDate, deliveredOn?: Temporal.PlainDate): boolean {
  return deliveredOn === undefined || Temporal.PlainDate.compare(deliveredOn, orderedOn) >= 0;
}

export function place(
  details: OrderDetails,
  by: AccountId,
  at: Temporal.Instant,
): Result<LiveOrder, Extract<OrderRefusal, "order_too_large">> {
  if (!fitsInMoney(details.lines)) {
    return err("order_too_large");
  }

  return ok({
    status: "live",
    id: orderIdSchema.parse(uuidv7()),
    ...details,
    payments: [],
    audit: Audits.start(by, at),
  });
}

// Customer, day, lines and note. What was paid stays, so the new total cannot fall below it.
export function revise(
  order: Order,
  details: OrderDetails,
  by: AccountId,
  at: Temporal.Instant,
): Result<
  LiveOrder,
  Extract<
    OrderRefusal,
    "order_deleted" | "order_too_large" | "total_below_paid" | "delivered_before_ordered"
  >
> {
  if (order.status === "deleted") {
    return err("order_deleted");
  }
  if (!fitsInMoney(details.lines)) {
    return err("order_too_large");
  }
  if (total(details) < paid(order)) {
    return err("total_below_paid");
  }
  if (!deliveredInTime(details.orderedOn, order.deliveredOn)) {
    return err("delivered_before_ordered");
  }

  return ok({ ...order, ...details, audit: Audits.change(order.audit, by, at) });
}

export function deliver(
  order: Order,
  on: Temporal.PlainDate,
  by: AccountId,
  at: Temporal.Instant,
): Result<LiveOrder, Extract<OrderRefusal, "order_deleted" | "delivered_before_ordered">> {
  if (order.status === "deleted") {
    return err("order_deleted");
  }
  if (!deliveredInTime(order.orderedOn, on)) {
    return err("delivered_before_ordered");
  }

  return ok({ ...order, deliveredOn: on, audit: Audits.change(order.audit, by, at) });
}

export function undeliver(
  order: Order,
  by: AccountId,
  at: Temporal.Instant,
): Result<LiveOrder, Extract<OrderRefusal, "order_deleted">> {
  if (order.status === "deleted") {
    return err("order_deleted");
  }

  const { deliveredOn: _deliveredOn, ...rest } = order;

  return ok({ ...rest, audit: Audits.change(order.audit, by, at) });
}

export function addPayment(
  order: Order,
  details: PaymentDetails,
  by: AccountId,
  at: Temporal.Instant,
): Result<
  { readonly order: LiveOrder; readonly payment: Payment },
  Extract<OrderRefusal, "order_deleted" | "payment_exceeds_owed">
> {
  if (order.status === "deleted") {
    return err("order_deleted");
  }
  if (details.amount > owed(order)) {
    return err("payment_exceeds_owed");
  }

  const payment: Payment = {
    id: paymentIdSchema.parse(uuidv7()),
    ...details,
    recordedAt: at,
    recordedBy: by,
  };

  return ok({
    order: {
      ...order,
      payments: [...order.payments, payment],
      audit: Audits.change(order.audit, by, at),
    },
    payment,
  });
}

export function removePayment(
  order: Order,
  paymentId: PaymentId,
  by: AccountId,
  at: Temporal.Instant,
): Result<LiveOrder, Extract<OrderRefusal, "order_deleted" | "payment_not_found">> {
  if (order.status === "deleted") {
    return err("order_deleted");
  }
  if (
    !order.payments.some((payment) => payment.id === paymentId && payment.removal === undefined)
  ) {
    return err("payment_not_found");
  }

  return ok({
    ...order,
    payments: order.payments.map((payment) =>
      payment.id === paymentId ? { ...payment, removal: Audits.deletion(by, at) } : payment,
    ),
    audit: Audits.change(order.audit, by, at),
  });
}

// A merge moves every order of the customer it hides, deleted ones too, so restoring one later finds the customer
// kept. Nothing else about the order changes.
export function reassignCustomer<T extends Order>(
  order: T,
  customerId: CustomerId,
  by: AccountId,
  at: Temporal.Instant,
): T {
  return { ...order, customerId, audit: Audits.change(order.audit, by, at) };
}

// A product merge moves the lines that sold the merged product to the one kept, at their own quantity and price
export function replaceProduct<T extends Order>(
  order: T,
  from: ProductId,
  into: ProductId,
  by: AccountId,
  at: Temporal.Instant,
): T {
  return {
    ...order,
    lines: order.lines.map((line) =>
      line.productId === from ? { ...line, productId: into } : line,
    ),
    audit: Audits.change(order.audit, by, at),
  };
}

// Soft, with Undo; deleting twice is harmless. `withCustomer` when it goes because its customer is deleted.
export function markDeleted(
  order: Order,
  by: AccountId,
  at: Temporal.Instant,
  withCustomer?: CustomerId,
): DeletedOrder {
  if (order.status === "deleted") {
    return order;
  }

  return {
    ...order,
    status: "deleted",
    audit: Audits.change(order.audit, by, at),
    deletion: Audits.deletion(by, at),
    deletedWith: withCustomer,
  };
}

// One deleted with its customer comes back only with them: `withCustomer` is that customer coming back
export function restore(
  order: Order,
  by: AccountId,
  at: Temporal.Instant,
  withCustomer?: CustomerId,
): Result<LiveOrder, Extract<OrderRefusal, "order_not_deleted" | "order_deleted_with_customer">> {
  if (order.status === "live") {
    return err("order_not_deleted");
  }
  if (order.deletedWith !== undefined && order.deletedWith !== withCustomer) {
    return err("order_deleted_with_customer");
  }

  const { deletion: _deletion, deletedWith: _deletedWith, ...rest } = order;

  return ok({ ...rest, status: "live", audit: Audits.change(order.audit, by, at) });
}
