import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";
import { searchText } from "@/shared/domain/search-text";

import type { CustomerId } from "./customer";

// Read as a module: `import * as CustomerAliases`. Another name a customer is known by, such as "chị Lan" for
// Nha khoa Lan Anh: the suggestions and the reading of a message match it as they match the name.

export const customerAliasIdSchema = z.uuid().brand<"CustomerAliasId">();

export type CustomerAliasId = z.infer<typeof customerAliasIdSchema>;

export type CustomerAlias = {
  readonly id: CustomerAliasId;
  readonly customerId: CustomerId;
  readonly name: string;
  readonly createdAt: Temporal.Instant;
  readonly createdBy: AccountId;
};

export function create(
  customerId: CustomerId,
  name: string,
  by: AccountId,
  at: Temporal.Instant,
): CustomerAlias {
  return {
    id: customerAliasIdSchema.parse(uuidv7()),
    customerId,
    name,
    createdAt: at,
    createdBy: by,
  };
}

// Whether a name is already one of these, ignoring case and diacritics
export function holds(names: ReadonlyArray<string>, name: string): boolean {
  const wanted = searchText(name);

  return names.some((each) => searchText(each) === wanted);
}
