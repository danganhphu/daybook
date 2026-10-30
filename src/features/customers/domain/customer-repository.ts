import type { Temporal } from "temporal-polyfill/implementation";

import type { SearchTerm } from "@/shared/domain/search-term";

import type { ArchivedCustomer, Customer, CustomerId } from "./customer";
import type { CustomerAlias, CustomerAliasId } from "./customer-alias";
import type { CustomerKindId } from "./customer-kind";

export type CustomerFilter = {
  // Every word in the name and area, or every word in one of the other names
  readonly search?: SearchTerm | undefined;
  readonly kindId?: CustomerKindId | undefined;
  // Archived is the hidden list: deleted customers are in the trash, not there
  readonly status: "active" | "archived";
};

// Reads only; writes go through the unit of work
export type CustomerRepository = {
  get(id: CustomerId): Promise<Customer | undefined>;
  getMany(ids: ReadonlyArray<CustomerId>): Promise<ReadonlyArray<Customer>>;
  // By name, at most `limit`
  list(filter: CustomerFilter, limit: number): Promise<ReadonlyArray<Customer>>;
  // Deleted at or after `since`, latest first, at most `limit`
  listDeleted(since: Temporal.Instant, limit: number): Promise<ReadonlyArray<ArchivedCustomer>>;
  // The other names of each customer that has any, oldest first
  aliasesOf(
    ids: ReadonlyArray<CustomerId>,
  ): Promise<ReadonlyMap<CustomerId, ReadonlyArray<CustomerAlias>>>;
  getAlias(id: CustomerAliasId): Promise<CustomerAlias | undefined>;
};
