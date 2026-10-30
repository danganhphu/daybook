import type { Temporal } from "temporal-polyfill/implementation";

import type { ArchivedKind, CustomerKind, CustomerKindId, KindPosition } from "./customer-kind";

// Reads only; writes go through the unit of work
export type CustomerKindRepository = {
  get(id: CustomerKindId): Promise<CustomerKind | undefined>;
  getMany(ids: ReadonlyArray<CustomerKindId>): Promise<ReadonlyArray<CustomerKind>>;
  // Active first by position, then archived; deleted ones are in the trash, not here, and their customers read as
  // having no kind
  list(): Promise<ReadonlyArray<CustomerKind>>;
  // Deleted at or after `since`, latest first, at most `limit`
  listDeleted(since: Temporal.Instant, limit: number): Promise<ReadonlyArray<ArchivedKind>>;
  // An active kind whose name matches, ignoring case and diacritics
  findActiveNamed(name: string): Promise<CustomerKind | undefined>;
  // After the last one
  nextPosition(): Promise<KindPosition>;
};
