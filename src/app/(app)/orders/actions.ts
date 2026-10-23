"use server";

import { refresh } from "next/cache";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import * as Orders from "@/features/orders/web/commands";
import type { CustomerSuggestion, ProductSuggestion } from "@/features/orders/web/order-view";
import type { Result } from "@/shared/domain/result";

// Anyone can call a server action, so each one checks the session first and the commands parse every argument.
// A change on the order's page answers the new version, for the next change, and refreshes the page; a refusal
// refreshes too, since it almost always means the page was out of date.

// The order's id, for the form to open its page; otherwise the sentence to show on the form
export async function placeOrder(input: unknown): Promise<Result<string, string>> {
  const app = daybook();
  const session = await requireSession(app);

  return Orders.placeOrder(app, session.accountId, input);
}

export async function reviseOrder(
  id: string,
  version: number,
  input: unknown,
): Promise<Result<string, string>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Orders.reviseOrder(app, session.accountId, id, version, input));
}

export async function deliverOrder(
  id: string,
  version: number,
  on: string,
): Promise<Orders.OrderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Orders.deliverOrder(app, session.accountId, id, version, on));
}

export async function undeliverOrder(
  id: string,
  version: number,
): Promise<Orders.OrderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Orders.undeliverOrder(app, session.accountId, id, version));
}

export async function takePayment(
  id: string,
  version: number,
  payment: unknown,
): Promise<Orders.OrderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Orders.takePayment(app, session.accountId, id, version, payment));
}

export async function removePayment(
  id: string,
  version: number,
  paymentId: string,
): Promise<Orders.OrderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Orders.removePayment(app, session.accountId, id, version, paymentId));
}

export async function deleteOrder(id: string, version: number): Promise<Orders.OrderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Orders.deleteOrder(app, session.accountId, id, version));
}

export async function restoreOrder(id: string, version: number): Promise<Orders.OrderChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Orders.restoreOrder(app, session.accountId, id, version));
}

export async function findCustomers(typed: string): Promise<ReadonlyArray<CustomerSuggestion>> {
  const app = daybook();
  await requireSession(app);

  return Orders.suggestCustomers(app, typed);
}

export async function findProducts(
  typed: string,
  customerId: string | undefined,
): Promise<ReadonlyArray<ProductSuggestion>> {
  const app = daybook();
  await requireSession(app);

  return Orders.suggestProducts(app, typed, customerId);
}

function refreshed<T>(result: Result<T, string>): Result<T, string> {
  refresh();

  return result;
}
