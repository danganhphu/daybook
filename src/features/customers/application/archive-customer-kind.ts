import * as CustomerKinds from "@/features/customers/domain/customer-kind";
import type { ArchivedKind, CustomerKindId } from "@/features/customers/domain/customer-kind";
import type { RecordChange } from "@/shared/application/record-change";
import { commitUnlessStale } from "@/shared/application/stale-write";
import * as Audits from "@/shared/domain/audit";
import { err, type Result } from "@/shared/domain/result";

import type { CustomerError } from "./customer-errors";
import type { CustomerKindDeps } from "./customer-kind-deps";

// Hidden from the customer form; the customers who have it keep it
export async function archiveCustomerKind(
  deps: CustomerKindDeps,
  input: RecordChange<CustomerKindId>,
): Promise<
  Result<
    ArchivedKind,
    Extract<CustomerError, "kind_not_found" | "kind_changed_elsewhere" | "kind_archived">
  >
> {
  const kind = await deps.kinds.get(input.id);
  if (kind === undefined) {
    return err("kind_not_found");
  }
  if (!Audits.isCurrent(kind.audit, input.shown)) {
    return err("kind_changed_elsewhere");
  }

  const archived = CustomerKinds.archive(kind, input.by, deps.clock());
  if (!archived.ok) {
    return archived;
  }

  const work = deps.startUnitOfWork();
  work.customerKinds.update(archived.value);

  return (await commitUnlessStale(work)) === "stale" ? err("kind_changed_elsewhere") : archived;
}
