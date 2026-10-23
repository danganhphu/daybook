import type { CustomerKind, CustomerKindId, KindPosition } from "./customer-kind";

// Reads only; writes go through the unit of work
export type CustomerKindRepository = {
  get(id: CustomerKindId): Promise<CustomerKind | undefined>;
  // Active first by position, then archived
  list(): Promise<ReadonlyArray<CustomerKind>>;
  // An active kind whose name matches, ignoring case and diacritics
  findActiveNamed(name: string): Promise<CustomerKind | undefined>;
  // After the last one
  nextPosition(): Promise<KindPosition>;
};
