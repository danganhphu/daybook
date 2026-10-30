import { z } from "zod";

import type { App } from "@/composition/create-app";
import { customerErrorMessages } from "@/features/customers/application/customer-errors";
import { customerIdSchema } from "@/features/customers/domain/customer";
import { customerKindIdSchema } from "@/features/customers/domain/customer-kind";
import { customersCopy } from "@/features/customers/web/customers-copy";
import { noteIdSchema } from "@/features/notes/domain/note";
import { deletedNotes } from "@/features/notes/web/commands";
import { orderIdSchema } from "@/features/orders/domain/order";
import { deletedOrders } from "@/features/orders/web/commands";
import { productErrorMessages } from "@/features/products/application/product-errors";
import { productIdSchema } from "@/features/products/domain/product";
import {
  inOrdersHiddenText,
  inOrdersText,
  productsCopy,
} from "@/features/products/web/products-copy";
import { reminderIdSchema } from "@/features/reminders/domain/reminder";
import { deletedReminders } from "@/features/reminders/web/commands";
import type { CustomerDeletePreview } from "@/features/trash/application/delete-customer";
import { trashErrorMessages } from "@/features/trash/application/trash-errors";
import type { TrashOutcome } from "@/features/trash/application/trash-outcome";
import { trashKinds, type TrashItem, type TrashKind } from "@/features/trash/domain/trash";
import type { AccountId } from "@/shared/domain/account-id";
import { versionSchema, type Audit, type Deletion } from "@/shared/domain/audit";
import { recentlyDeletedSince } from "@/shared/domain/recently-deleted";
import { err, ok, type Result } from "@/shared/domain/result";
import { actionLabels } from "@/shared/ui/action-labels";
import {
  deleteQuestion,
  recentlyDeleted,
  recentlyDeletedCopy,
  type DeletedRowView,
} from "@/shared/web/recently-deleted";
import { deletedText } from "@/shared/web/recently-deleted-since";

import { takenText, trashCopy } from "./trash-copy";

// "Đã xoá gần đây"'s work, minus the framework: one list of every kind, newest first; what the browser sends back about
// it, parsed before the app sees it; and the question before a customer or a product goes in

export type TrashRowView = DeletedRowView & { readonly kind: TrashKind };

type Named = {
  readonly id: string;
  readonly name: string;
  readonly audit: Audit;
  readonly deletion: Deletion | undefined;
};

// `said` adds what else the row says before when it went, such as what a customer took with them
function namedRows(
  records: ReadonlyArray<Named>,
  people: ReadonlyMap<AccountId, string>,
  said: (id: string) => string | undefined = () => undefined,
): ReadonlyArray<DeletedRowView> {
  return records.flatMap(({ id, name, audit, deletion }) => {
    if (deletion === undefined) {
      return [];
    }
    const when = deletedText(deletion.deletedAt, people.get(deletion.deletedBy) ?? "?");
    const before = said(id);

    return [
      {
        id,
        version: audit.version,
        title: name,
        detail: before === undefined ? when : `${before}, ${when}`,
        deletedAt: deletion.deletedAt.epochMilliseconds,
      },
    ];
  });
}

// "Ghi chú, Xoá 26/10 (Lan)": one list holds every kind, so each row says which it is; an order's row already does
function withKind(
  kind: TrashKind,
  rows: ReadonlyArray<DeletedRowView>,
): ReadonlyArray<TrashRowView> {
  return rows.map(({ id, version, title, detail, deletedAt }) => ({
    id,
    version,
    title,
    detail: kind === "order" ? detail : `${trashCopy.kinds[kind]}, ${detail}`,
    deletedAt,
    kind,
  }));
}

export async function trashScreen(app: App): Promise<ReadonlyArray<TrashRowView>> {
  const since = recentlyDeletedSince(app.now());
  const people = await app.displayNames();
  const [orders, notes, reminders, customers, products, kinds] = await Promise.all([
    deletedOrders(app, people),
    deletedNotes(app, people),
    deletedReminders(app, people),
    app.listDeletedCustomers(since, recentlyDeleted.limit),
    app.listDeletedProducts(since, recentlyDeleted.limit),
    app.listDeletedCustomerKinds(since, recentlyDeleted.limit),
  ]);
  const taken = new Map<string, CustomerDeletePreview>(
    await app.deletedWithCounts(customers.map((customer) => customer.id)),
  );
  // "kèm 5 đơn và 2 việc cần nhắc"
  const takenWith = (id: string) => {
    const counts = taken.get(id);
    const what = counts === undefined ? undefined : takenText(counts.orders, counts.reminders);
    return what === undefined ? undefined : `kèm ${what}`;
  };

  return [
    ...withKind("order", orders),
    ...withKind("note", notes),
    ...withKind("reminder", reminders),
    ...withKind("customer", namedRows(customers, people, takenWith)),
    ...withKind("product", namedRows(products, people)),
    ...withKind("kind", namedRows(kinds, people)),
  ].toSorted((a, b) => b.deletedAt - a.deletedAt);
}

// What the screen sends for each thing chosen: which kind, which one, and the version it showed
const itemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("order"), id: orderIdSchema, shown: versionSchema }),
  z.object({ kind: z.literal("note"), id: noteIdSchema, shown: versionSchema }),
  z.object({ kind: z.literal("reminder"), id: reminderIdSchema, shown: versionSchema }),
  z.object({ kind: z.literal("customer"), id: customerIdSchema, shown: versionSchema }),
  z.object({ kind: z.literal("product"), id: productIdSchema, shown: versionSchema }),
  z.object({ kind: z.literal("kind"), id: customerKindIdSchema, shown: versionSchema }),
]);

// No more than the screen can show: each kind lists at most its limit
const itemsSchema = z
  .array(itemSchema)
  .min(1)
  .max(trashKinds.length * recentlyDeleted.limit);

function parseItems(items: unknown): ReadonlyArray<TrashItem> | undefined {
  const parsed = itemsSchema.safeParse(items);

  return parsed.success ? parsed.data : undefined;
}

// How many went, and why each that did not, by id, for the screen to name it
export type TrashOutcomeView = {
  readonly done: number;
  readonly refused: ReadonlyArray<{ readonly id: string; readonly message: string }>;
};

function toOutcomeView(outcome: TrashOutcome): TrashOutcomeView {
  return {
    done: outcome.done,
    refused: outcome.refused.map(({ item, error }) => ({
      id: item.id,
      message: trashErrorMessages[error],
    })),
  };
}

export async function restoreFromTrash(
  app: App,
  by: AccountId,
  items: unknown,
): Promise<Result<TrashOutcomeView, string>> {
  const chosen = parseItems(items);
  if (chosen === undefined) {
    return err(trashErrorMessages.trash_not_found);
  }

  const restored = await app.restoreFromTrash(by, chosen);

  return restored.ok ? ok(toOutcomeView(restored.value)) : err(trashErrorMessages[restored.error]);
}

export async function purgeFromTrash(
  app: App,
  items: unknown,
): Promise<Result<TrashOutcomeView, string>> {
  const chosen = parseItems(items);

  return chosen === undefined
    ? err(trashErrorMessages.trash_not_found)
    : ok(toOutcomeView(await app.purgeFromTrash(chosen)));
}

// The question before a delete, from what the server knows: how much a customer takes with them, or that a product
// any order names is hidden instead
export type DeleteConfirmView = {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  // The answer hides it rather than deleting it
  readonly hideInstead: boolean;
};

export async function customerDeleteConfirm(
  app: App,
  id: unknown,
): Promise<Result<DeleteConfirmView, string>> {
  const customerId = customerIdSchema.safeParse(id);
  if (!customerId.success) {
    return err(customerErrorMessages.customer_not_found);
  }

  const taken = await app.customerDeletePreview(customerId.data);
  const what = takenText(taken.orders, taken.reminders);

  return ok({
    title: deleteQuestion(customersCopy.one),
    description:
      what === undefined
        ? recentlyDeletedCopy.canRestore
        : `Kèm ${what}. ${recentlyDeletedCopy.canRestore}`,
    confirmLabel: actionLabels.remove,
    hideInstead: false,
  });
}

// Answers the version after the delete, for the toast's Undo
export async function deleteCustomer(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
): Promise<Result<number, string>> {
  const customerId = customerIdSchema.safeParse(id);
  const shown = versionSchema.safeParse(version);
  if (!customerId.success || !shown.success) {
    return err(customerErrorMessages.customer_not_found);
  }

  const deleted = await app.deleteCustomer({ id: customerId.data, by, shown: shown.data });

  return deleted.ok ? ok(deleted.value.audit.version) : err(customerErrorMessages[deleted.error]);
}

export async function productDeleteConfirm(
  app: App,
  id: unknown,
): Promise<Result<DeleteConfirmView, string>> {
  const productId = productIdSchema.safeParse(id);
  if (!productId.success) {
    return err(productErrorMessages.product_not_found);
  }

  const [product, orders] = await Promise.all([
    app.getProduct(productId.data),
    app.productOrderCount(productId.data),
  ]);
  if (product === undefined) {
    return err(productErrorMessages.product_not_found);
  }
  if (orders > 0 && product.status === "archived") {
    return err(inOrdersHiddenText(orders));
  }

  return ok(
    orders > 0
      ? {
          title: productsCopy.cannotDelete,
          description: inOrdersText(orders),
          confirmLabel: productsCopy.hide,
          hideInstead: true,
        }
      : {
          title: deleteQuestion(productsCopy.one),
          description: recentlyDeletedCopy.canRestore,
          confirmLabel: actionLabels.remove,
          hideInstead: false,
        },
  );
}

export async function deleteProduct(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
): Promise<Result<number, string>> {
  const productId = productIdSchema.safeParse(id);
  const shown = versionSchema.safeParse(version);
  if (!productId.success || !shown.success) {
    return err(productErrorMessages.product_not_found);
  }

  const deleted = await app.deleteProduct({ id: productId.data, by, shown: shown.data });

  return deleted.ok ? ok(deleted.value.audit.version) : err(productErrorMessages[deleted.error]);
}
