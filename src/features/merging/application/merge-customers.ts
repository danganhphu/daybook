import type { Temporal } from "temporal-polyfill/implementation";

import * as Customers from "@/features/customers/domain/customer";
import type { ActiveCustomer, CustomerId } from "@/features/customers/domain/customer";
import * as CustomerAliases from "@/features/customers/domain/customer-alias";
import type { CustomerAlias } from "@/features/customers/domain/customer-alias";
import * as Merges from "@/features/merging/domain/merge";
import type { CustomerMerge } from "@/features/merging/domain/merge";
import * as Orders from "@/features/orders/domain/order";
import * as OrderChanges from "@/features/orders/domain/order-change";
import * as Reminders from "@/features/reminders/domain/reminder";
import { commitUnlessStale } from "@/shared/application/stale-write";
import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";

import type { MergeInput, MergingDeps } from "./merging-deps";
import type { MergeError } from "./merging-errors";

export type CustomerMergeError = Extract<
  MergeError,
  | "merge_into_itself"
  | "customer_not_found"
  | "customer_changed_elsewhere"
  | "customer_merged"
  | "customer_deleted"
  | "customer_kept_unavailable"
>;

// The names the merged customer was known by that the kept one does not hold yet, as the kept one's other names
function namesToKeep(
  from: { readonly name: string },
  fromAliases: ReadonlyArray<CustomerAlias>,
  into: ActiveCustomer,
  intoAliases: ReadonlyArray<CustomerAlias>,
  by: AccountId,
  at: Temporal.Instant,
): ReadonlyArray<CustomerAlias> {
  const held = [into.name, ...intoAliases.map((alias) => alias.name)];
  const kept: CustomerAlias[] = [];
  for (const name of [from.name, ...fromAliases.map((alias) => alias.name)]) {
    if (!CustomerAliases.holds([...held, ...kept.map((alias) => alias.name)], name)) {
      kept.push(CustomerAliases.create(into.id, name, by, at));
    }
  }

  return kept;
}

// Two customers who are one: every order and reminder of the first moves to the second, each order's log says so,
// the first is hidden naming the second, and its names become the second's other names, so the next message that
// calls it "chị Lan" is matched. One batch; no Undo, so the screen confirms first, and the merge is recorded.
export async function mergeCustomers(
  deps: MergingDeps,
  input: MergeInput<CustomerId>,
): Promise<Result<CustomerMerge, CustomerMergeError>> {
  if (input.id === input.into) {
    return err("merge_into_itself");
  }
  const [from, into] = await Promise.all([
    deps.customers.get(input.id),
    deps.customers.get(input.into),
  ]);
  if (from === undefined) {
    return err("customer_not_found");
  }
  if (!Audits.isCurrent(from.audit, input.shown)) {
    return err("customer_changed_elsewhere");
  }
  if (into?.status !== "active") {
    return err("customer_kept_unavailable");
  }

  const at = deps.clock();
  const merged = Customers.mergeInto(from, into, input.by, at);
  if (!merged.ok) {
    return merged;
  }

  const [orders, reminders, aliases] = await Promise.all([
    deps.orders.forCustomer(from.id),
    deps.reminders.forCustomer(from.id),
    deps.customers.aliasesOf([from.id, into.id]),
  ]);
  const fromAliases = aliases.get(from.id) ?? [];
  const record = Merges.customerMerge(
    from.id,
    into.id,
    {
      orderIds: orders.map((order) => order.id),
      reminderIds: reminders.map((reminder) => reminder.id),
    },
    input.by,
    at,
  );

  // Both customers first, so a change either one saw since it was read aborts the batch before anything moves
  const work = deps.startUnitOfWork();
  work.customers.update(merged.value);
  work.customers.update(Customers.absorbMerge(into, input.by, at));
  for (const order of orders) {
    const moved = Orders.reassignCustomer(order, into.id, input.by, at);
    work.orders.update(moved, OrderChanges.record("customer_merged", order, moved));
  }
  for (const reminder of reminders) {
    work.reminders.update(Reminders.reassignCustomer(reminder, into.id, input.by, at));
  }
  work.customerAliases.remove(fromAliases.map((alias) => alias.id));
  work.customerAliases.add(
    namesToKeep(from, fromAliases, into, aliases.get(into.id) ?? [], input.by, at),
  );
  work.merges.addCustomerMerge(record);

  return (await commitUnlessStale(work)) === "stale"
    ? err("customer_changed_elsewhere")
    : ok(record);
}
