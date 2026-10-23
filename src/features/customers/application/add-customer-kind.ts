import * as CustomerKinds from "@/features/customers/domain/customer-kind";
import type { ActiveKind, KindName } from "@/features/customers/domain/customer-kind";
import type { AccountId } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";

import type { CustomerError } from "./customer-errors";
import type { CustomerKindDeps } from "./customer-kind-deps";

export type AddCustomerKindInput = { readonly by: AccountId; readonly name: KindName };

// A new kind goes last in the list. Two active kinds never share a name, ignoring case and diacritics.
export async function addCustomerKind(
  deps: CustomerKindDeps,
  input: AddCustomerKindInput,
): Promise<Result<ActiveKind, Extract<CustomerError, "kind_name_taken">>> {
  if ((await deps.kinds.findActiveNamed(input.name)) !== undefined) {
    return err("kind_name_taken");
  }

  const kind = CustomerKinds.create(
    input.name,
    await deps.kinds.nextPosition(),
    input.by,
    deps.clock(),
  );
  const work = deps.startUnitOfWork();
  work.customerKinds.add(kind);
  await work.commit();

  return ok(kind);
}
