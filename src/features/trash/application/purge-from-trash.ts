import { itemsOf, trashKinds, type TrashItem, type TrashKind } from "@/features/trash/domain/trash";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import type { Audit } from "@/shared/domain/audit";
import { recentlyDeletedSince } from "@/shared/domain/recently-deleted";

import type { TrashDeps } from "./trash-deps";
import { asShown, byId, distinct, type TrashOutcome, type TrashRefusal } from "./trash-outcome";
import type { TrashWrites } from "./trash-writes";

type Found = { readonly audit: Audit; readonly deleted: boolean };

// Each kind read as the trash needs it: as shown, and still deleted
async function found(
  deps: TrashDeps,
  items: ReadonlyArray<TrashItem>,
): Promise<ReadonlyMap<string, Found>> {
  const [notes, orders, reminders, customers, products, kinds] = await Promise.all([
    deps.notes.getMany(itemsOf(items, "note").map((item) => item.id)),
    deps.orders.getMany(itemsOf(items, "order").map((item) => item.id)),
    deps.reminders.getMany(itemsOf(items, "reminder").map((item) => item.id)),
    deps.customers.getMany(itemsOf(items, "customer").map((item) => item.id)),
    deps.products.getMany(itemsOf(items, "product").map((item) => item.id)),
    deps.kinds.getMany(itemsOf(items, "kind").map((item) => item.id)),
  ]);

  return byId([
    ...[...notes, ...orders, ...reminders].map((each) => ({
      id: each.id,
      audit: each.audit,
      deleted: each.status === "deleted",
    })),
    ...[...customers, ...products, ...kinds].map((each) => ({
      id: each.id,
      audit: each.audit,
      deleted: each.status === "archived" && each.deletion !== undefined,
    })),
  ]);
}

// Gone from the database, in one batch: a customer with every order and reminder of theirs still in the trash. One
// gone already is done; one restored meanwhile stays, and is said.
export async function purgeFromTrash(
  deps: TrashDeps,
  chosen: ReadonlyArray<TrashItem>,
): Promise<TrashOutcome> {
  const items = distinct(chosen);
  const records = await found(deps, items);
  const refused: TrashRefusal[] = [];
  const going = new Map<TrashKind, string[]>();
  let done = 0;
  for (const item of items) {
    const record = records.get(item.id);
    if (record === undefined) {
      done += 1;
      continue;
    }
    const shown = asShown(item, record);
    if (typeof shown === "string" || !shown.deleted) {
      refused.push({ item, error: typeof shown === "string" ? shown : "trash_not_deleted" });
      continue;
    }
    going.set(item.kind, [...(going.get(item.kind) ?? []), item.id]);
    done += 1;
  }

  if (going.size > 0) {
    const at = deps.clock();
    const work = deps.startUnitOfWork();
    for (const kind of trashKinds) {
      const ids = going.get(kind);
      if (ids !== undefined) {
        work.trash.purge(kind, ids, at);
      }
    }
    await work.commit();
  }

  return { done, refused };
}

export type EmptyTrashDeps = {
  readonly clock: Clock;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly trash: TrashWrites }>;
};

// The daily run: whatever has been in the trash longer than it keeps things leaves the database
export async function emptyExpiredTrash(deps: EmptyTrashDeps): Promise<void> {
  const now = deps.clock();
  const work = deps.startUnitOfWork();
  work.trash.purgeDeletedBefore(recentlyDeletedSince(now), now);
  await work.commit();
}
