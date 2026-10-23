import type { Customer } from "@/features/customers/domain/customer";
import type {
  CustomerFilter,
  CustomerRepository,
} from "@/features/customers/domain/customer-repository";

// Two people's customers fit on one screen; past this, the search narrows it
export const customersListLimit = 200;

export type CustomersFound = {
  // By name
  readonly customers: ReadonlyArray<Customer>;
  readonly more: boolean;
};

export async function listCustomers(
  deps: { readonly customers: CustomerRepository },
  filter: CustomerFilter,
): Promise<CustomersFound> {
  const found = await deps.customers.list(filter, customersListLimit + 1);

  return {
    customers: found.slice(0, customersListLimit),
    more: found.length > customersListLimit,
  };
}
