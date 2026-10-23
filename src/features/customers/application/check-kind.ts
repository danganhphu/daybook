import type { CustomerKindId } from "@/features/customers/domain/customer-kind";
import type { CustomerKindRepository } from "@/features/customers/domain/customer-kind-repository";
import { err, ok, type Result } from "@/shared/domain/result";

import type { CustomerError } from "./customer-errors";

// The kind a customer is given must exist, and be offered - unless the customer has it already, so a customer whose
// kind was hidden can still be edited without losing it
export async function checkKind(
  kinds: CustomerKindRepository,
  kindId: CustomerKindId | undefined,
  current: CustomerKindId | undefined,
): Promise<Result<void, Extract<CustomerError, "kind_not_found" | "kind_archived">>> {
  if (kindId === undefined || kindId === current) {
    return ok(undefined);
  }

  const kind = await kinds.get(kindId);
  if (kind === undefined) {
    return err("kind_not_found");
  }

  return kind.status === "archived" ? err("kind_archived") : ok(undefined);
}
