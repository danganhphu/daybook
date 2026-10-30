"use server";

import { refresh } from "next/cache";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import * as Customers from "@/features/customers/web/commands";
import type { KindResult } from "@/features/customers/web/commands";

// Customer kinds, managed in Settings. No step-up: they are the book's data, not its security. Each answer refreshes
// the page, so the list shows what is stored now.

export async function addKind(name: string): Promise<KindResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Customers.addKind(app, session.accountId, name));
}

export async function renameKind(id: string, version: number, name: string): Promise<KindResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Customers.renameKind(app, session.accountId, id, version, name));
}

export async function hideKind(id: string, version: number): Promise<KindResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Customers.hideKind(app, session.accountId, id, version));
}

export async function showKind(id: string, version: number): Promise<KindResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Customers.showKind(app, session.accountId, id, version));
}

export async function deleteKind(id: string, version: number): Promise<KindResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Customers.deleteKind(app, session.accountId, id, version));
}

function refreshed(result: KindResult): KindResult {
  refresh();

  return result;
}
