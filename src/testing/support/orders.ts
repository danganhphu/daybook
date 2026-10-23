import { Temporal } from "temporal-polyfill/implementation";

import type { App } from "@/composition/create-app";
import { customerDetailsSchema, type ActiveCustomer } from "@/features/customers/domain/customer";
import { kindNameSchema } from "@/features/customers/domain/customer-kind";
import type { LineInput } from "@/features/orders/application/order-input";
import { quantitySchema, type LiveOrder } from "@/features/orders/domain/order";
import { productNameSchema, type ProductId } from "@/features/products/domain/product";
import { moneySchema } from "@/shared/domain/money";

import { theAuthor } from "./app";
import { expectOk } from "./result";

// Builders for tests about customers and orders, through the app as a screen would use it

export async function aCustomer(
  app: App,
  name: string,
  fields: Record<string, unknown> = {},
): Promise<ActiveCustomer> {
  return expectOk(
    await app.addCustomer({
      by: await theAuthor(),
      details: customerDetailsSchema.parse({ name, ...fields }),
    }),
  );
}

export async function aKind(app: App, name: string) {
  return expectOk(
    await app.addCustomerKind({ by: await theAuthor(), name: kindNameSchema.parse(name) }),
  );
}

// A line naming a product by name, new or known
export function line(name: string, quantity: number, unitPrice: number): LineInput {
  return {
    product: { name: productNameSchema.parse(name) },
    quantity: quantitySchema.parse(quantity),
    unitPrice: moneySchema.parse(unitPrice),
  };
}

export function lineOf(productId: ProductId, quantity: number, unitPrice: number): LineInput {
  return {
    product: { id: productId },
    quantity: quantitySchema.parse(quantity),
    unitPrice: moneySchema.parse(unitPrice),
  };
}

export async function anOrder(
  app: App,
  customer: { readonly id: ActiveCustomer["id"] },
  lines: ReadonlyArray<LineInput>,
  orderedOn = "2026-10-23",
): Promise<LiveOrder> {
  return expectOk(
    await app.placeOrder({
      by: await theAuthor(),
      order: {
        customerId: customer.id,
        orderedOn: Temporal.PlainDate.from(orderedOn),
        lines,
        note: undefined,
      },
    }),
  );
}
