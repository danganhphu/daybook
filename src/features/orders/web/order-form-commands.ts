import { z } from "zod";

import type { App } from "@/composition/create-app";
import { customerIdSchema } from "@/features/customers/domain/customer";
import { orderErrorMessages } from "@/features/orders/application/order-errors";
import type { LineInput, OrderInput } from "@/features/orders/application/order-input";
import { orderLimits, quantitySchema } from "@/features/orders/domain/order";
import { productIdSchema, productNameSchema } from "@/features/products/domain/product";
import type { AccountId } from "@/shared/domain/account-id";
import { calendarDaySchema } from "@/shared/domain/calendar-day";
import { moneySchema } from "@/shared/domain/money-schema";
import { err, ok, type Result } from "@/shared/domain/result";
import { searchTermSchema } from "@/shared/domain/search-term";

import { orderScreen, parseChange, refusal } from "./order-page-commands";
import type { CustomerSuggestion, OrderFormView, ProductSuggestion } from "./order-view";

// The order form - a new order or one changed whole - and the suggestions under its fields, minus the framework

// How many suggestions show under a field
export const suggestionLimit = 8;

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
