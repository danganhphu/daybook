import type { Temporal } from "temporal-polyfill/implementation";

import type { TrashKind } from "@/features/trash/domain/trash";

// Deleting for good, on the same unit of work as the rest: the rows leave the database with everything that is theirs.
// Each statement touches only what is still in the trash, so a thing restored meanwhile stays whole.
export type TrashWrites = {
  // `at` stamps the customers a kind gone for good is taken off
  purge(kind: TrashKind, ids: ReadonlyArray<string>, at: Temporal.Instant): void;
  // Every kind, everything deleted before `before`: the daily run
  purgeDeletedBefore(before: Temporal.Instant, at: Temporal.Instant): void;
};
