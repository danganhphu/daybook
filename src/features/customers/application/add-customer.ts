import * as Customers from "@/features/customers/domain/customer";
import type { ActiveCustomer, CustomerDetails } from "@/features/customers/domain/customer";
import type { AccountId } from "@/shared/domain/account-id";
import { ok, type Result } from "@/shared/domain/result";

import { checkKind } from "./check-kind";
import type { CustomerDeps } from "./customer-deps";
import type { CustomerError } from "./customer-errors";

export type AddCustomerInput = { readonly by: AccountId; readonly details: CustomerDetails };

export async function addCustomer(
  deps: CustomerDeps,
  input: AddCustomerInput,
): Promise<Result<ActiveCustomer, Extract<CustomerError, "kind_not_found" | "kind_archived">>> {
  const kind = await checkKind(deps.kinds, input.details.kindId, undefined);
  if (!kind.ok) {
    return kind;
  }

  const customer = Customers.create(input.details, input.by, deps.clock());
  const work = deps.startUnitOfWork();
  work.customers.add(customer);
  await work.commit();

  return ok(customer);
}
