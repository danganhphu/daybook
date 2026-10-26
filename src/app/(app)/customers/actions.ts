"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import * as Customers from "@/features/customers/web/commands";
import type { CustomerFormState, CustomerResult } from "@/features/customers/web/commands";
import * as Merging from "@/features/merging/web/commands";
import type { MergeConfirmView } from "@/features/merging/web/commands";
import type { Result } from "@/shared/domain/result";
import { customerPath } from "@/shared/web/routes";

// Anyone can call a server action, so each one checks the session first and the commands parse every argument

// The new customer's page on success; otherwise the form again, with what was typed and why it was refused
export async function addCustomer(
  _previous: CustomerFormState,
  form: FormData,
): Promise<CustomerFormState> {
  const app = daybook();
  const session = await requireSession(app);
  const added = await Customers.addCustomer(app, session.accountId, form);
  if (!added.ok) {
    return added.error;
  }

  return redirect(customerPath(added.value));
}

export async function reviseCustomer(
  id: string,
  _previous: CustomerFormState,
  form: FormData,
): Promise<CustomerFormState> {
  const app = daybook();
  const session = await requireSession(app);
  const revised = await Customers.reviseCustomer(app, session.accountId, id, form);
  if (!revised.ok) {
    return revised.error;
  }

  return redirect(customerPath(revised.value));
}

export async function hideCustomer(id: string, version: number): Promise<CustomerResult> {
  const app = daybook();
  const session = await requireSession(app);
  const result = await Customers.archiveCustomer(app, session.accountId, id, version);
  refresh();

  return result;
}

export async function showCustomer(id: string, version: number): Promise<CustomerResult> {
  const app = daybook();
  const session = await requireSession(app);
  const result = await Customers.restoreCustomer(app, session.accountId, id, version);
  refresh();

  return result;
}

export async function addCustomerName(id: string, name: string): Promise<Result<null, string>> {
  const app = daybook();
  const session = await requireSession(app);
  const result = await Customers.addCustomerAlias(app, session.accountId, id, name);
  refresh();

  return result;
}

export async function removeCustomerName(aliasId: string): Promise<Result<null, string>> {
  const app = daybook();
  await requireSession(app);
  const result = await Customers.removeCustomerAlias(app, aliasId);
  refresh();

  return result;
}

// What merging into `intoId` will move, before anything does
export async function customerMergeConfirm(
  id: string,
  intoId: string,
): Promise<Result<MergeConfirmView, string>> {
  const app = daybook();
  await requireSession(app);

  return Merging.customerMergeConfirm(app, id, intoId);
}

// The kept customer's id, for the page to go there
export async function mergeCustomer(
  id: string,
  version: number,
  intoId: string,
): Promise<Result<string, string>> {
  const app = daybook();
  const session = await requireSession(app);
  const result = await Merging.mergeCustomers(app, session.accountId, id, version, intoId);
  refresh();

  return result;
}
