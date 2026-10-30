"use server";

import { refresh } from "next/cache";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import * as Merging from "@/features/merging/web/commands";
import type { MergeConfirmView } from "@/features/merging/web/commands";
import * as Products from "@/features/products/web/commands";
import type { ProductChangeResult } from "@/features/products/web/commands";
import * as Trash from "@/features/trash/web/commands";
import type { DeleteConfirmView } from "@/features/trash/web/commands";
import type { Result } from "@/shared/domain/result";

// Anyone can call a server action, so each one checks the session first and the commands parse every argument. A
// change refreshes the page, which then shows it - or, after a refusal, what the other person did.

function refreshed<T>(result: Result<T, string>): Result<T, string> {
  refresh();

  return result;
}

// The new product's id, for the page to open it
export async function addProduct(name: string): Promise<Result<string, string>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Products.addProduct(app, session.accountId, name));
}

export async function renameProduct(
  id: string,
  version: number,
  name: string,
): Promise<ProductChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Products.renameProduct(app, session.accountId, id, version, name));
}

export async function hideProduct(id: string, version: number): Promise<ProductChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Products.archiveProduct(app, session.accountId, id, version));
}

export async function showProduct(id: string, version: number): Promise<ProductChangeResult> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Products.restoreProduct(app, session.accountId, id, version));
}

export async function addProductName(id: string, name: string): Promise<Result<null, string>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Products.addProductAlias(app, session.accountId, id, name));
}

export async function removeProductName(aliasId: string): Promise<Result<null, string>> {
  const app = daybook();
  await requireSession(app);

  return refreshed(await Products.removeProductAlias(app, aliasId));
}

// Delete, or hide instead when an order names it: asked before either
export async function productDeleteConfirm(id: string): Promise<Result<DeleteConfirmView, string>> {
  const app = daybook();
  await requireSession(app);

  return Trash.productDeleteConfirm(app, id);
}

// The version after the delete, for the toast's Undo
export async function deleteProduct(id: string, version: number): Promise<Result<number, string>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Trash.deleteProduct(app, session.accountId, id, version));
}

// What merging into `intoId` will move, before anything does
export async function productMergeConfirm(
  id: string,
  intoId: string,
): Promise<Result<MergeConfirmView, string>> {
  const app = daybook();
  await requireSession(app);

  return Merging.productMergeConfirm(app, id, intoId);
}

// The kept product's id, for the page to go there
export async function mergeProduct(
  id: string,
  version: number,
  intoId: string,
): Promise<Result<string, string>> {
  const app = daybook();
  const session = await requireSession(app);

  return refreshed(await Merging.mergeProducts(app, session.accountId, id, version, intoId));
}
