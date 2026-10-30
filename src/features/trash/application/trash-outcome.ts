import type { TrashItem } from "@/features/trash/domain/trash";
import * as Audits from "@/shared/domain/audit";
import type { Audit } from "@/shared/domain/audit";

import type { TrashError } from "./trash-errors";

export type TrashRefusal = { readonly item: TrashItem; readonly error: TrashError };

// What a restore or a delete for good did with what was chosen: those it could not are said one by one
export type TrashOutcome = {
  readonly done: number;
  readonly refused: ReadonlyArray<TrashRefusal>;
};

// One entry per thing, however often the screen sent it
export function distinct(items: ReadonlyArray<TrashItem>): ReadonlyArray<TrashItem> {
  return [...new Map(items.map((item) => [`${item.kind}:${item.id}`, item])).values()];
}

export function byId<T extends { readonly id: string }>(records: ReadonlyArray<T>) {
  return new Map<string, T>(records.map((record) => [record.id, record]));
}

// The record as the screen showed it, or why not
export function asShown<T extends { readonly audit: Audit }>(
  item: TrashItem,
  found: T | undefined,
): T | TrashError {
  if (found === undefined) {
    return "trash_not_found";
  }

  return Audits.isCurrent(found.audit, item.shown) ? found : "trash_changed_elsewhere";
}
