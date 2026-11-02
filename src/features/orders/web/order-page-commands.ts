import type { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import type { App } from "@/composition/create-app";
import { customerIdSchema, type Customer } from "@/features/customers/domain/customer";
import { orderErrorMessages, type OrderError } from "@/features/orders/application/order-errors";
import * as Orders from "@/features/orders/domain/order";
import {
  orderIdSchema,
  paymentDetailsSchema,
  paymentIdSchema,
  type Order,
} from "@/features/orders/domain/order";
import type { ProductId } from "@/features/products/domain/product";
import type { AccountId } from "@/shared/domain/account-id";
import { versionSchema } from "@/shared/domain/audit";
import { calendarDaySchema } from "@/shared/domain/calendar-day";
import { err, ok, type Result } from "@/shared/domain/result";
import { vietnamDate } from "@/shared/domain/vietnam-day";
import { clockTime } from "@/shared/web/time-text";

import { shortDay } from "./day-text";
import { changeText } from "./history-text";
import type { OrderScreenView } from "./order-view";

// One order's page - what it shows and the changes made on it - minus the framework: parse what the browser sent,
// call the app, answer with a view or the sentence the user reads. Server actions and pages wrap these.

function whenText(instant: Temporal.Instant): string {
  return `${shortDay(vietnamDate(instant).toString())}, ${clockTime(instant.epochMilliseconds)}`;
}

export async function orderScreen(app: App, id: unknown): Promise<OrderScreenView | undefined> {
  const orderId = orderIdSchema.safeParse(id);
  if (!orderId.success) {
    return undefined;
  }

  const [order, history, people] = await Promise.all([
    app.getOrder(orderId.data),
    app.orderHistory(orderId.data),
    app.displayNames(),
  ]);
  if (order === undefined) {
    return undefined;
  }

  // Every product and customer the order or its history names, looked up once
  const productIds = new Set<ProductId>(order.lines.map((line) => line.productId));
  const customerIds = new Set<string>([order.customerId]);
  for (const change of history) {
    for (const snapshot of [change.before, change.after]) {
      snapshot?.lines.forEach((line) => productIds.add(line.productId));
      if (snapshot !== undefined) {
        customerIds.add(snapshot.customerId);
      }
    }
  }
  const [products, customers] = await Promise.all([
    app.getProducts([...productIds]),
    app.getCustomers([...customerIds].map((each) => customerIdSchema.parse(each))),
  ]);
  const productNames = new Map<string, string>(
    products.map((product) => [product.id, product.name]),
  );
  const customerById = new Map<string, Customer>(
    customers.map((customer) => [customer.id, customer]),
  );
  const names = {
    product: (each: string) => productNames.get(each) ?? "?",
    customer: (each: string) => customerById.get(each)?.name ?? "?",
  };
  const customer = customerById.get(order.customerId);

  return {
    id: order.id,
    version: order.audit.version,
    deleted: order.status === "deleted",
    customerId: order.customerId,
    customerName: customer?.name ?? "?",
    customerArea: customer?.area,
    orderedOn: order.orderedOn.toString(),
    deliveredOn: order.deliveredOn?.toString(),
    note: order.note,
    lines: order.lines.map((line, position) => ({
      position,
      productId: line.productId,
      productName: names.product(line.productId),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: Orders.lineAmount(line),
    })),
    total: Orders.total(order),
    paid: Orders.paid(order),
    owed: Orders.owed(order),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      paidOn: payment.paidOn.toString(),
      method: payment.method,
      note: payment.note,
      removed: payment.removal !== undefined,
    })),
    history: history
      .map((change) => {
        const text = changeText(change.kind, change.before, change.after, names);
        return {
          id: change.id,
          at: whenText(change.at),
          by: people.get(change.by) ?? "?",
          headline: text.headline,
          details: text.details,
        };
      })
      .toReversed(),
    today: app.today().toString(),
  };
}

export function refusal(error: OrderError): string {
  return orderErrorMessages[error];
}

// The order a change is for, as the screen showed it; undefined for an id or version that is not one
export function parseChange(by: AccountId, id: unknown, version: unknown) {
  const orderId = orderIdSchema.safeParse(id);
  const shown = versionSchema.safeParse(version);

  return orderId.success && shown.success ? { id: orderId.data, by, shown: shown.data } : undefined;
}

// What a change on the order's page answers: the order's new version, for the next change, or the sentence
export type OrderChangeResult = Result<number, string>;

function answered(result: Result<Order, OrderError>): OrderChangeResult {
  return result.ok ? ok(result.value.audit.version) : err(refusal(result.error));
}

export async function deliverOrder(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
  on: unknown,
): Promise<OrderChangeResult> {
  const change = parseChange(by, id, version);
  const day = calendarDaySchema.safeParse(on);
  if (change === undefined || !day.success) {
    return err(orderErrorMessages.order_not_found);
  }

  return answered(await app.deliverOrder({ ...change, on: day.data }));
}

export async function undeliverOrder(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
): Promise<OrderChangeResult> {
  const change = parseChange(by, id, version);

  return change === undefined
    ? err(orderErrorMessages.order_not_found)
    : answered(await app.undeliverOrder(change));
}

const paymentFormSchema = z.object({
  amount: z.number(),
  paidOn: calendarDaySchema,
  method: z.enum(["cash", "transfer", ""]),
  note: z.string(),
});

export async function takePayment(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
  input: unknown,
): Promise<OrderChangeResult> {
  const change = parseChange(by, id, version);
  if (change === undefined) {
    return err(orderErrorMessages.order_not_found);
  }
  const form = paymentFormSchema.safeParse(input);
  const payment = paymentDetailsSchema.safeParse(
    form.success
      ? {
          amount: form.data.amount,
          paidOn: form.data.paidOn,
          method: form.data.method === "" ? undefined : form.data.method,
          note: form.data.note,
        }
      : undefined,
  );
  if (!payment.success) {
    return err(payment.error.issues[0]?.message ?? "Số tiền chưa đúng");
  }

  return answered(await app.addPayment({ ...change, payment: payment.data }));
}

export async function removePayment(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
  paymentId: unknown,
): Promise<OrderChangeResult> {
  const change = parseChange(by, id, version);
  const payment = paymentIdSchema.safeParse(paymentId);
  if (change === undefined || !payment.success) {
    return err(orderErrorMessages.payment_not_found);
  }

  return answered(await app.removePayment({ ...change, paymentId: payment.data }));
}

export async function deleteOrder(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
): Promise<OrderChangeResult> {
  const change = parseChange(by, id, version);

  return change === undefined
    ? err(orderErrorMessages.order_not_found)
    : answered(await app.deleteOrder(change));
}

export async function restoreOrder(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
): Promise<OrderChangeResult> {
  const change = parseChange(by, id, version);

  return change === undefined
    ? err(orderErrorMessages.order_not_found)
    : answered(await app.restoreOrder(change));
}
