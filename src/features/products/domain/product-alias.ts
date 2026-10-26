import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";

import type { ProductId, ProductName } from "./product";

// Read as a module: `import * as ProductAliases`. Another name a product is known by, such as "gel tê" for Thuốc tê:
// an order line or a message that names it means that product. A name means one product, among names and others.

export const productAliasIdSchema = z.uuid().brand<"ProductAliasId">();

export type ProductAliasId = z.infer<typeof productAliasIdSchema>;

export type ProductAlias = {
  readonly id: ProductAliasId;
  readonly productId: ProductId;
  readonly name: ProductName;
  readonly createdAt: Temporal.Instant;
  readonly createdBy: AccountId;
};

export function create(
  productId: ProductId,
  name: ProductName,
  by: AccountId,
  at: Temporal.Instant,
): ProductAlias {
  return {
    id: productAliasIdSchema.parse(uuidv7()),
    productId,
    name,
    createdAt: at,
    createdBy: by,
  };
}
