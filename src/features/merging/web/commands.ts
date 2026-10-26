import type { App } from "@/composition/create-app";
import { customerIdSchema } from "@/features/customers/domain/customer";
import { mergeErrorMessages } from "@/features/merging/application/merging-errors";
import { productIdSchema } from "@/features/products/domain/product";
import type { AccountId } from "@/shared/domain/account-id";
import { versionSchema } from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";

import { confirmCustomerMerge, confirmProductMerge, confirmTitle } from "./merging-copy";

// The merge dialogs' work, minus the framework: parse what the browser sent, call the app, answer with the
// confirmation to show or the sentence the user reads

// What the confirmation says before anything moves
export type MergeConfirmView = {
  readonly title: string;
  readonly description: string;
};

export async function customerMergeConfirm(
  app: App,
  fromId: unknown,
  intoId: unknown,
): Promise<Result<MergeConfirmView, string>> {
  const from = customerIdSchema.safeParse(fromId);
  const into = customerIdSchema.safeParse(intoId);
  if (!from.success || !into.success) {
    return err(mergeErrorMessages.customer_not_found);
  }
  if (from.data === into.data) {
    return err(mergeErrorMessages.merge_into_itself);
  }

  const [merged, kept, moved] = await Promise.all([
    app.getCustomer(from.data),
    app.getCustomer(into.data),
    app.customerMergePreview(from.data),
  ]);
  if (merged === undefined) {
    return err(mergeErrorMessages.customer_not_found);
  }
  if (kept?.status !== "active") {
    return err(mergeErrorMessages.customer_kept_unavailable);
  }

  return ok({
    title: confirmTitle(merged.name, kept.name),
    description: confirmCustomerMerge(merged.name, kept.name, moved),
  });
}

// Answers the kept customer's id, for the page to go there
export async function mergeCustomers(
  app: App,
  by: AccountId,
  fromId: unknown,
  version: unknown,
  intoId: unknown,
): Promise<Result<string, string>> {
  const from = customerIdSchema.safeParse(fromId);
  const into = customerIdSchema.safeParse(intoId);
  const shown = versionSchema.safeParse(version);
  if (!from.success || !into.success || !shown.success) {
    return err(mergeErrorMessages.customer_not_found);
  }

  const merged = await app.mergeCustomers({
    id: from.data,
    by,
    shown: shown.data,
    into: into.data,
  });

  return merged.ok ? ok(merged.value.intoId) : err(mergeErrorMessages[merged.error]);
}

export async function productMergeConfirm(
  app: App,
  fromId: unknown,
  intoId: unknown,
): Promise<Result<MergeConfirmView, string>> {
  const from = productIdSchema.safeParse(fromId);
  const into = productIdSchema.safeParse(intoId);
  if (!from.success || !into.success) {
    return err(mergeErrorMessages.product_not_found);
  }
  if (from.data === into.data) {
    return err(mergeErrorMessages.merge_into_itself);
  }

  const [merged, kept, moved] = await Promise.all([
    app.getProduct(from.data),
    app.getProduct(into.data),
    app.productMergePreview(from.data),
  ]);
  if (merged === undefined) {
    return err(mergeErrorMessages.product_not_found);
  }
  if (kept?.status !== "active") {
    return err(mergeErrorMessages.product_kept_unavailable);
  }

  return ok({
    title: confirmTitle(merged.name, kept.name),
    description: confirmProductMerge(merged.name, kept.name, moved.orders),
  });
}

// Answers the kept product's id, for the page to go there
export async function mergeProducts(
  app: App,
  by: AccountId,
  fromId: unknown,
  version: unknown,
  intoId: unknown,
): Promise<Result<string, string>> {
  const from = productIdSchema.safeParse(fromId);
  const into = productIdSchema.safeParse(intoId);
  const shown = versionSchema.safeParse(version);
  if (!from.success || !into.success || !shown.success) {
    return err(mergeErrorMessages.product_not_found);
  }

  const merged = await app.mergeProducts({
    id: from.data,
    by,
    shown: shown.data,
    into: into.data,
  });

  return merged.ok ? ok(merged.value.intoId) : err(mergeErrorMessages[merged.error]);
}
