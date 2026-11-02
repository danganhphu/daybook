"use server";

import { refreshed } from "@/app/refreshed";
import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import * as OrderForm from "@/features/orders/web/order-form-commands";
import * as OrderPage from "@/features/orders/web/order-page-commands";
import type { CustomerSuggestion, ProductSuggestion } from "@/features/orders/web/order-view";
import type { Result } from "@/shared/domain/result";

// Anyone can call a server action, so each one checks the session first and the commands parse every argument.
// A change on the order's page answers the new version, for the next change, and refreshes the page; a refusal
// refreshes too, since it almost always means the page was out of date.

// The order's id, for the form to open its page; otherwise the sentence to show on the form
export async function placeOrder(input: unknown): Promise<Result<string, string>> {
  const app = daybook();
  const session = await requireSession(app);

  return OrderForm.placeOrder(app, session.accountId, input);
}

export async function reviseOrder(
  id: string,
  version: number,
  input: unknown,
): Promise<Result<string, string>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await OrderForm.reviseOrder(app, session.accountId, id, version, input));
}

export async function deliverOrder(
  id: string,
  version: number,
  on: string,
): Promise<OrderPage.OrderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await OrderPage.deliverOrder(app, session.accountId, id, version, on));
}

export async function undeliverOrder(
  id: string,
  version: number,
): Promise<OrderPage.OrderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await OrderPage.undeliverOrder(app, session.accountId, id, version));
}

export async function takePayment(
  id: string,
  version: number,
  payment: unknown,
): Promise<OrderPage.OrderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await OrderPage.takePayment(app, session.accountId, id, version, payment));
}

export async function removePayment(
  id: string,
  version: number,
  paymentId: string,
): Promise<OrderPage.OrderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await OrderPage.removePayment(app, session.accountId, id, version, paymentId));
}

export async function deleteOrder(
  id: string,
  version: number,
): Promise<OrderPage.OrderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await OrderPage.deleteOrder(app, session.accountId, id, version));
}

export async function restoreOrder(
  id: string,
  version: number,
): Promise<OrderPage.OrderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await OrderPage.restoreOrder(app, session.accountId, id, version));
}

export async function findCustomers(typed: string): Promise<ReadonlyArray<CustomerSuggestion>> {
  const app = daybook();
  await requireSession(app);

  return OrderForm.suggestCustomers(app, typed);
}

export async function findProducts(
  typed: string,
  customerId: string | undefined,
): Promise<ReadonlyArray<ProductSuggestion>> {
  const app = daybook();
  await requireSession(app);

  return OrderForm.suggestProducts(app, typed, customerId);
}
