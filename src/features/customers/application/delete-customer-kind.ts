import * as CustomerKinds from "@/features/customers/domain/customer-kind";
import type { ArchivedKind, CustomerKindId } from "@/features/customers/domain/customer-kind";
import type { RecordChange } from "@/shared/application/record-change";
import { commitUnlessStale } from "@/shared/application/stale-write";
import * as Audits from "@/shared/domain/audit";
import { err, type Result } from "@/shared/domain/result";

import type { CustomerError } from "./customer-errors";
import type { CustomerKindDeps } from "./customer-kind-deps";

// Into the trash; its customers read as having no kind until it comes back, and lose it once it is gone for good
export async function deleteCustomerKind(
  deps: CustomerKindDeps,
  input: RecordChange<CustomerKindId>,
): Promise<
  Result<
    ArchivedKind,
    Extract<CustomerError, "kind_not_found" | "kind_changed_elsewhere" | "kind_deleted">
  >
> {
  const kind = await deps.kinds.get(input.id);
  if (kind === undefined) {
    return err("kind_not_found");
  }
  if (!Audits.isCurrent(kind.audit, input.shown)) {
    return err("kind_changed_elsewhere");
  }

  const deleted = CustomerKinds.markDeleted(kind, input.by, deps.clock());
  if (!deleted.ok) {
    return deleted;
  }

  const work = deps.startUnitOfWork();
  work.customerKinds.update(deleted.value);

  return (await commitUnlessStale(work)) === "stale" ? err("kind_changed_elsewhere") : deleted;
}
