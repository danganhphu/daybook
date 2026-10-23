import type { CustomerKindRepository } from "@/features/customers/domain/customer-kind-repository";
import type { CustomerRepository } from "@/features/customers/domain/customer-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

import type { CustomerWrites } from "./customer-writes";

// What every customer use case needs
export type CustomerDeps = {
  readonly clock: Clock;
  readonly customers: CustomerRepository;
  readonly kinds: CustomerKindRepository;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly customers: CustomerWrites }>;
};
