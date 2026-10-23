import type { Customer } from "@/features/customers/domain/customer";
import type { CustomerKind } from "@/features/customers/domain/customer-kind";

// Queue changes on the current unit of work; nothing is stored until it commits
export type CustomerKindWrites = {
  add(kind: CustomerKind): void;
  update(kind: CustomerKind): void;
};

export type CustomerWrites = {
  add(customer: Customer): void;
  update(customer: Customer): void;
};
