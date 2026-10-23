import * as CustomerKinds from "@/features/customers/domain/customer-kind";
import type {
  CustomerKind,
  CustomerKindId,
  KindName,
} from "@/features/customers/domain/customer-kind";
import type { RecordChange } from "@/shared/application/record-change";
import { commitUnlessStale } from "@/shared/application/stale-write";
import * as Audits from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";

import type { CustomerError } from "./customer-errors";
import type { CustomerKindDeps } from "./customer-kind-deps";

export type RenameCustomerKindInput = RecordChange<CustomerKindId> & { readonly name: KindName };

export async function renameCustomerKind(
  deps: CustomerKindDeps,
  input: RenameCustomerKindInput,
): Promise<
  Result<
    CustomerKind,
    Extract<CustomerError, "kind_not_found" | "kind_changed_elsewhere" | "kind_name_taken">
  >
> {
  const kind = await deps.kinds.get(input.id);
  if (kind === undefined) {
    return err("kind_not_found");
  }
  if (!Audits.isCurrent(kind.audit, input.shown)) {
    return err("kind_changed_elsewhere");
  }

  const namesake = await deps.kinds.findActiveNamed(input.name);
  if (namesake !== undefined && namesake.id !== kind.id) {
    return err("kind_name_taken");
  }

  const renamed = CustomerKinds.rename(kind, input.name, input.by, deps.clock());
  const work = deps.startUnitOfWork();
  work.customerKinds.update(renamed);

  return (await commitUnlessStale(work)) === "stale" ? err("kind_changed_elsewhere") : ok(renamed);
}
