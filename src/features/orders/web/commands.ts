import { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import type { App } from "@/composition/create-app";
import { customerIdSchema, type Customer } from "@/features/customers/domain/customer";
import { customerKindIdSchema } from "@/features/customers/domain/customer-kind";
import { toKindView, type KindView } from "@/features/customers/web/customer-view";
import { clockTime } from "@/features/notes/web/note-view";
import { orderErrorMessages, type OrderError } from "@/features/orders/application/order-errors";
import type { LineInput, OrderInput } from "@/features/orders/application/order-input";
import type { OrderFilter } from "@/features/orders/application/order-queries";
import * as Orders from "@/features/orders/domain/order";
import {
  orderIdSchema,
  orderLimits,
  paymentDetailsSchema,
  paymentIdSchema,
  quantitySchema,
  type Order,
} from "@/features/orders/domain/order";
import {
  productIdSchema,
  productNameSchema,
  type ProductId,
} from "@/features/products/domain/product";
import type { AccountId } from "@/shared/domain/account-id";
import { versionSchema } from "@/shared/domain/audit";
import { calendarDaySchema } from "@/shared/domain/calendar-day";
import { moneySchema } from "@/shared/domain/money-schema";
import { err, ok, type Result } from "@/shared/domain/result";
import { searchTermSchema } from "@/shared/domain/search-term";
import { vietnamDate } from "@/shared/domain/vietnam-day";
import { dayLabel } from "@/shared/web/day-label";
import { moneyText } from "@/shared/web/money-text";
import { recentlyDeleted, type DeletedRowView } from "@/shared/web/recently-deleted";
import { deletedText, recentlyDeletedSince } from "@/shared/web/recently-deleted-since";

import { monthLabel, shortDay } from "./day-text";
import { changeText } from "./history-text";
import type {
  CustomerSuggestion,
  OrderFormView,
  OrderRowView,
  OrderScreenView,
  OrderTotalsView,
  ProductSuggestion,
} from "./order-view";
import { ordersCopy } from "./orders-copy";
import { orderStatusFilters, ordersPath, type OrderStatusFilter } from "./orders-path";

// The order screens' work, minus the framework: parse what the browser sent, call the app, answer with a view or the
// sentence the user reads. Server actions and pages wrap these; tests call them directly.

// A screen of orders, enough for two people's month; more means the filter should be narrower
export const ordersListLimit = 200;

// How many suggestions show under a field
export const suggestionLimit = 8;

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .transform((text) => Temporal.PlainYearMonth.from(text));

export type OrdersView = {
  // YYYY-MM
  readonly month: string;
  readonly title: string;
  readonly previousPath: string;
  // None past this month
  readonly nextPath: string | undefined;
  readonly status: OrderStatusFilter | "";
  readonly kindId: string;
  readonly kinds: ReadonlyArray<KindView>;
  readonly totals: OrderTotalsView;
  // Newest day first, each day's orders newest first
  readonly days: ReadonlyArray<{
    readonly day: string;
    readonly label: string;
    readonly rows: ReadonlyArray<OrderRowView>;
  }>;
  readonly more: boolean;
  readonly filtered: boolean;
};

export async function ordersScreen(
  app: App,
  params: { readonly month?: unknown; readonly status?: unknown; readonly kind?: unknown },
): Promise<OrdersView> {
  const today = app.today();
  const thisMonth = today.toPlainYearMonth();
  const asked = monthSchema.safeParse(params.month);
  const month = asked.success ? asked.data : thisMonth;
  const status = z.enum(orderStatusFilters).safeParse(params.status);
  const kind = customerKindIdSchema.safeParse(params.kind);
  const filter = {
    from: month.toPlainDate({ day: 1 }),
    to: month.toPlainDate({ day: month.daysInMonth }),
    kindId: kind.success ? kind.data : undefined,
    delivery: status.data === "undelivered" ? ("undelivered" as const) : undefined,
    payment: status.data === "owed" ? ("owed" as const) : undefined,
  };
  const query = {
    status: status.success ? status.data : undefined,
    kind: kind.success ? kind.data : undefined,
  };

  const [rows, totals, kinds] = await Promise.all([
    app.listOrders(filter, ordersListLimit + 1),
    app.orderTotals(filter),
    app.listCustomerKinds(),
  ]);
  const shown = rows.slice(0, ordersListLimit);
  const byDay = Map.groupBy(shown, (row) => row.orderedOn.toString());
  const next = month.add({ months: 1 });

  return {
    month: month.toString(),
    title: monthLabel(month.toString()),
    previousPath: ordersPath({ ...query, month: month.subtract({ months: 1 }).toString() }),
    nextPath:
      Temporal.PlainYearMonth.compare(next, thisMonth) > 0
        ? undefined
        : ordersPath({ ...query, month: next.equals(thisMonth) ? undefined : next.toString() }),
    status: status.success ? status.data : "",
    kindId: kind.success ? kind.data : "",
    kinds: kinds.filter((each) => each.status === "active").map(toKindView),
    totals,
    days: [...byDay].map(([day, dayRows]) => ({
      day,
      label: dayLabel(Temporal.PlainDate.from(day), today),
      rows: dayRows.map((row) => ({
        id: row.id,
        customerName: row.customerName,
        customerArea: row.customerArea,
        products: row.productNames.join(", "),
        total: row.total,
        owed: Math.max(row.total - row.paid, 0),
        delivered: row.deliveredOn !== undefined,
      })),
    })),
    more: rows.length > ordersListLimit,
    filtered: status.success || kind.success,
  };
}

// Earlier than any order in the book, for a list that is not about a period
const beforeAnyOrder = Temporal.PlainDate.from("2000-01-01");

export type DatedOrderRowView = OrderRowView & { readonly orderedOn: string };

// The newest orders of one customer, for their page
export function customerOrders(
  app: App,
  customerId: string,
): Promise<ReadonlyArray<DatedOrderRowView>> {
  return newestOrders(app, { customerId: customerIdSchema.parse(customerId) });
}

// The newest orders that sold one product, for its page
export function productOrders(
  app: App,
  productId: string,
): Promise<ReadonlyArray<DatedOrderRowView>> {
  return newestOrders(app, { productId: productIdSchema.parse(productId) });
}

async function newestOrders(
  app: App,
  narrowed: Pick<OrderFilter, "customerId" | "productId">,
): Promise<ReadonlyArray<DatedOrderRowView>> {
  const rows = await app.listOrders(
    { from: beforeAnyOrder, to: app.today(), ...narrowed },
    ordersListLimit,
  );

  return rows.map((row) => ({
    id: row.id,
    orderedOn: row.orderedOn.toString(),
    customerName: row.customerName,
    customerArea: row.customerArea,
    products: row.productNames.join(", "),
    total: row.total,
    owed: Math.max(row.total - row.paid, 0),
    delivered: row.deliveredOn !== undefined,
  }));
}

// Orders deleted lately, for "Đã xoá gần đây"; `people` names who deleted each
export async function deletedOrders(
  app: App,
  people: ReadonlyMap<AccountId, string>,
): Promise<ReadonlyArray<DeletedRowView>> {
  const rows = await app.listDeletedOrders(recentlyDeletedSince(app.now()), recentlyDeleted.limit);

  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    title: row.customerName,
    detail: [
      `${ordersCopy.order} ${shortDay(row.orderedOn.toString())}`,
      moneyText(row.total),
      deletedText(row.deletedAt, people.get(row.deletedBy) ?? "?"),
    ].join(", "),
  }));
}

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

export async function orderForm(
  app: App,
  params: { readonly id?: unknown; readonly customer?: unknown },
): Promise<OrderFormView | undefined> {
  const today = app.today().toString();
  if (params.id === undefined) {
    const customerId = customerIdSchema.safeParse(params.customer);
    const customer = customerId.success ? await app.getCustomer(customerId.data) : undefined;

    return {
      order: undefined,
      customer:
        customer?.status === "active"
          ? { id: customer.id, name: customer.name, area: customer.area }
          : undefined,
      today,
    };
  }

  const view = await orderScreen(app, params.id);
  if (view === undefined || view.deleted) {
    return undefined;
  }

  return {
    order: {
      id: view.id,
      version: view.version,
      orderedOn: view.orderedOn,
      note: view.note,
      lines: view.lines,
    },
    customer: { id: view.customerId, name: view.customerName, area: view.customerArea },
    today,
  };
}

// What the order form sends: a line names a known product by id, or a new one by name
const orderFormSchema = z.object({
  customerId: customerIdSchema,
  orderedOn: calendarDaySchema,
  note: z.string(),
  lines: z
    .array(
      z.object({
        productId: productIdSchema.optional(),
        productName: z.string(),
        quantity: quantitySchema,
        unitPrice: moneySchema,
      }),
    )
    .min(1)
    .max(orderLimits.lines),
});

export type OrderFormInput = z.input<typeof orderFormSchema>;

const formRefused = "Đơn chưa đủ: cần khách, ngày, và mỗi sản phẩm có tên, số lượng, giá.";

function parseOrderForm(input: unknown): Result<OrderInput, string> {
  const parsed = orderFormSchema.safeParse(input);
  if (!parsed.success) {
    return err(formRefused);
  }

  const lines: LineInput[] = [];
  for (const line of parsed.data.lines) {
    if (line.productId !== undefined) {
      lines.push({
        product: { id: line.productId },
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      });
      continue;
    }
    const name = productNameSchema.safeParse(line.productName);
    if (!name.success) {
      return err(name.error.issues[0]?.message ?? formRefused);
    }
    lines.push({
      product: { name: name.data },
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    });
  }

  const note = parsed.data.note.trim();
  if (note.length > orderLimits.note) {
    return err(`Ghi chú tối đa ${orderLimits.note} ký tự`);
  }

  return ok({
    customerId: parsed.data.customerId,
    orderedOn: parsed.data.orderedOn,
    lines,
    note: note === "" ? undefined : note.normalize("NFC"),
  });
}

function refusal(error: OrderError): string {
  return orderErrorMessages[error];
}

// Answers the order's id
export async function placeOrder(
  app: App,
  by: AccountId,
  input: unknown,
): Promise<Result<string, string>> {
  const order = parseOrderForm(input);
  if (!order.ok) {
    return order;
  }

  const placed = await app.placeOrder({ by, order: order.value });

  return placed.ok ? ok(placed.value.id) : err(refusal(placed.error));
}

function parseChange(by: AccountId, id: unknown, version: unknown) {
  const orderId = orderIdSchema.safeParse(id);
  const shown = versionSchema.safeParse(version);

  return orderId.success && shown.success ? { id: orderId.data, by, shown: shown.data } : undefined;
}

export async function reviseOrder(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
  input: unknown,
): Promise<Result<string, string>> {
  const change = parseChange(by, id, version);
  if (change === undefined) {
    return err(orderErrorMessages.order_not_found);
  }
  const order = parseOrderForm(input);
  if (!order.ok) {
    return order;
  }

  const revised = await app.reviseOrder({ ...change, order: order.value });

  return revised.ok ? ok(revised.value.id) : err(refusal(revised.error));
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

// Suggestions under the order form's fields

export async function suggestCustomers(
  app: App,
  typed: unknown,
): Promise<ReadonlyArray<CustomerSuggestion>> {
  const term = searchTermSchema.safeParse(typed);
  if (!term.success) {
    return [];
  }

  const found = await app.listCustomers({ search: term.data, status: "active" });

  return found.customers
    .slice(0, suggestionLimit)
    .map((customer) => ({ id: customer.id, name: customer.name, area: customer.area }));
}

export async function suggestProducts(
  app: App,
  typed: unknown,
  customerId: unknown,
): Promise<ReadonlyArray<ProductSuggestion>> {
  const term = searchTermSchema.safeParse(typed);
  if (!term.success) {
    return [];
  }

  const products = await app.searchProducts(term.data, suggestionLimit);
  const customer = customerIdSchema.safeParse(customerId);
  const prices = await app.lastPrices(
    products.map((product) => product.id),
    customer.success ? customer.data : undefined,
  );

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    lastPrice: prices.get(product.id),
  }));
}
