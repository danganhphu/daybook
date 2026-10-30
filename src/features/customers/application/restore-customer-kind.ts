import * as CustomerKinds from "@/features/customers/domain/customer-kind";
import type { ActiveKind, CustomerKindId } from "@/features/customers/domain/customer-kind";
import type { RecordChange } from "@/shared/application/record-change";
import { commitUnlessStale } from "@/shared/application/stale-write";
import * as Audits from "@/shared/domain/audit";
import { err, type Result } from "@/shared/domain/result";

import type { CustomerError } from "./customer-errors";
import type { CustomerKindDeps } from "./customer-kind-deps";

// Offered again, unless another active kind took its name meanwhile
export async function restoreCustomerKind(
  deps: CustomerKindDeps,
  input: RecordChange<CustomerKindId>,
): Promise<
  Result<
    ActiveKind,
    Extract<
      CustomerError,
      | "kind_not_found"
      | "kind_changed_elsewhere"
      | "kind_not_archived"
      | "kind_deleted"
      | "kind_name_taken"
    >
  >
> {
  const kind = await deps.kinds.get(input.id);
  if (kind === undefined) {
    return err("kind_not_found");
  }
  if (!Audits.isCurrent(kind.audit, input.shown)) {
    return err("kind_changed_elsewhere");
  }

  const restored = CustomerKinds.restore(kind, input.by, deps.clock());
  if (!restored.ok) {
    return restored;
  }
  if ((await deps.kinds.findActiveNamed(kind.name)) !== undefined) {
    return err("kind_name_taken");
  }

  const work = deps.startUnitOfWork();
  work.customerKinds.update(restored.value);

  return (await commitUnlessStale(work)) === "stale" ? err("kind_changed_elsewhere") : restored;
}
