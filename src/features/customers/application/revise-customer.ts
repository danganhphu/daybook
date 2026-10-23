import * as Customers from "@/features/customers/domain/customer";
import type { Customer, CustomerDetails, CustomerId } from "@/features/customers/domain/customer";
import type { RecordChange } from "@/shared/application/record-change";
import { commitUnlessStale } from "@/shared/application/stale-write";
import * as Audits from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";

import { checkKind } from "./check-kind";
import type { CustomerDeps } from "./customer-deps";
import type { CustomerError } from "./customer-errors";

export type ReviseCustomerInput = RecordChange<CustomerId> & { readonly details: CustomerDetails };

export async function reviseCustomer(
  deps: CustomerDeps,
  input: ReviseCustomerInput,
): Promise<
  Result<
    Customer,
    Extract<
      CustomerError,
      "customer_not_found" | "customer_changed_elsewhere" | "kind_not_found" | "kind_archived"
    >
  >
> {
  const customer = await deps.customers.get(input.id);
  if (customer === undefined) {
    return err("customer_not_found");
  }
  if (!Audits.isCurrent(customer.audit, input.shown)) {
    return err("customer_changed_elsewhere");
  }

  const kind = await checkKind(deps.kinds, input.details.kindId, customer.kindId);
  if (!kind.ok) {
    return kind;
  }

  const revised = Customers.revise(customer, input.details, input.by, deps.clock());
  const work = deps.startUnitOfWork();
  work.customers.update(revised);

  return (await commitUnlessStale(work)) === "stale"
    ? err("customer_changed_elsewhere")
    : ok(revised);
}
