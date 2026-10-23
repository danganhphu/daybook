import type { CustomerKindRepository } from "@/features/customers/domain/customer-kind-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

import type { CustomerKindWrites } from "./customer-writes";

// What every customer-kind use case needs
export type CustomerKindDeps = {
  readonly clock: Clock;
  readonly kinds: CustomerKindRepository;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly customerKinds: CustomerKindWrites }>;
};
