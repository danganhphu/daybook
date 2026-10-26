import type { CustomerId } from "@/features/customers/domain/customer";
import * as CustomerAliases from "@/features/customers/domain/customer-alias";
import type { CustomerAlias, CustomerAliasId } from "@/features/customers/domain/customer-alias";
import type { CustomerRepository } from "@/features/customers/domain/customer-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import type { AccountId } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";

import type { CustomerError } from "./customer-errors";
import type { CustomerAliasWrites } from "./customer-writes";

export type CustomerAliasDeps = {
  readonly clock: Clock;
  readonly customers: CustomerRepository;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly customerAliases: CustomerAliasWrites }>;
};

export type AddCustomerAliasInput = {
  readonly by: AccountId;
  readonly customerId: CustomerId;
  // Checked by customerNameSchema
  readonly name: string;
};

// Another name for a customer in the list, unless it is already their name or one of their others
export async function addCustomerAlias(
  deps: CustomerAliasDeps,
  input: AddCustomerAliasInput,
): Promise<
  Result<
    CustomerAlias,
    Extract<CustomerError, "customer_not_found" | "customer_archived" | "alias_taken">
  >
> {
  const customer = await deps.customers.get(input.customerId);
  if (customer === undefined) {
    return err("customer_not_found");
  }
  if (customer.status === "archived") {
    return err("customer_archived");
  }
  const others = (await deps.customers.aliasesOf([customer.id])).get(customer.id) ?? [];
  if (CustomerAliases.holds([customer.name, ...others.map((alias) => alias.name)], input.name)) {
    return err("alias_taken");
  }

  const alias = CustomerAliases.create(customer.id, input.name, input.by, deps.clock());
  const work = deps.startUnitOfWork();
  work.customerAliases.add([alias]);
  await work.commit();

  return ok(alias);
}

// Removed outright: nothing points at a name, and who removed it is not worth a record of its own
export async function removeCustomerAlias(
  deps: CustomerAliasDeps,
  aliasId: CustomerAliasId,
): Promise<Result<CustomerAlias, Extract<CustomerError, "alias_not_found">>> {
  const alias = await deps.customers.getAlias(aliasId);
  if (alias === undefined) {
    return err("alias_not_found");
  }

  const work = deps.startUnitOfWork();
  work.customerAliases.remove([alias.id]);
  await work.commit();

  return ok(alias);
}
