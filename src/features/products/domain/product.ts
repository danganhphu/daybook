import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";
import type { Archival, Audit } from "@/shared/domain/audit";
import { requiredTextSchema } from "@/shared/domain/short-text";

// Read as a module: `import * as Products`. Made where an order line names something new, so there is no catalogue
// to fill in first. Its last price is read from the orders, never stored here.

export const productIdSchema = z.uuid().brand<"ProductId">();

export type ProductId = z.infer<typeof productIdSchema>;

export const productNameMaxLength = 100;

export const productNameSchema = requiredTextSchema(productNameMaxLength, {
  empty: "Chưa nhập tên hàng",
  tooLong: `Tên hàng tối đa ${productNameMaxLength} ký tự`,
}).brand<"ProductName">();

export type ProductName = z.infer<typeof productNameSchema>;

type ProductFields = {
  readonly id: ProductId;
  readonly name: ProductName;
  readonly audit: Audit;
};

export type ActiveProduct = ProductFields & { readonly status: "active" };

export type ArchivedProduct = ProductFields & {
  readonly status: "archived";
  readonly archival: Archival;
};

export type Product = ActiveProduct | ArchivedProduct;

export function create(name: ProductName, by: AccountId, at: Temporal.Instant): ActiveProduct {
  return {
    status: "active",
    id: productIdSchema.parse(uuidv7()),
    name,
    audit: Audits.start(by, at),
  };
}
