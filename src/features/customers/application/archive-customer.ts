import * as Customers from "@/features/customers/domain/customer";
import type { ArchivedCustomer, CustomerId } from "@/features/customers/domain/customer";
import type { RecordChange } from "@/shared/application/record-change";
import { commitUnlessStale } from "@/shared/application/stale-write";
import * as Audits from "@/shared/domain/audit";
import { err, type Result } from "@/shared/domain/result";

import type { CustomerDeps } from "./customer-deps";
import type { CustomerError } from "./customer-errors";

export async function archiveCustomer(
  deps: CustomerDeps,
  input: RecordChange<CustomerId>,
): Promise<
  Result<
    ArchivedCustomer,
    Extract<
      CustomerError,
      "customer_not_found" | "customer_changed_elsewhere" | "customer_archived"
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

  const archived = Customers.archive(customer, input.by, deps.clock());
  if (!archived.ok) {
    return archived;
  }

  const work = deps.startUnitOfWork();
  work.customers.update(archived.value);

  return (await commitUnlessStale(work)) === "stale" ? err("customer_changed_elsewhere") : archived;
}
