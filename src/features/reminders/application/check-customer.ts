import type { CustomerId } from "@/features/customers/domain/customer";
import type { CustomerRepository } from "@/features/customers/domain/customer-repository";
import { err, ok, type Result } from "@/shared/domain/result";

// A new customer for a reminder must be in the list; the one it already has may stay even if hidden since
export async function checkCustomer(
  customers: CustomerRepository,
  wanted: CustomerId | undefined,
  current: CustomerId | undefined,
): Promise<Result<void, "customer_unavailable">> {
  if (wanted === undefined || wanted === current) {
    return ok(undefined);
  }

  const customer = await customers.get(wanted);

  return customer?.status === "active" ? ok(undefined) : err("customer_unavailable");
}
