import type { ProductRepository } from "@/features/products/domain/product-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

import type { ProductAliasWrites, ProductWrites } from "./product-writes";

// What every product use case needs
export type ProductDeps = {
  readonly clock: Clock;
  readonly products: ProductRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly products: ProductWrites;
    readonly productAliases: ProductAliasWrites;
  }>;
};
