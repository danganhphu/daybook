import type { CustomerError } from "@/features/customers/application/customer-errors";
import * as Customers from "@/features/customers/domain/customer";
import type { ArchivedCustomer, CustomerId } from "@/features/customers/domain/customer";
import * as Orders from "@/features/orders/domain/order";
import * as OrderChanges from "@/features/orders/domain/order-change";
import * as Reminders from "@/features/reminders/domain/reminder";
import type { RecordChange } from "@/shared/application/record-change";
import { commitUnlessStale } from "@/shared/application/stale-write";
import * as Audits from "@/shared/domain/audit";
import { err, type Result } from "@/shared/domain/result";

import type { TrashDeps } from "./trash-deps";

// What deleting a customer takes with them, for the question before it: what the screens show of theirs
export type CustomerDeletePreview = {
  readonly orders: number;
  readonly reminders: number;
};

export async function customerDeletePreview(
  deps: Pick<TrashDeps, "orders" | "reminders">,
  id: CustomerId,
): Promise<CustomerDeletePreview> {
  const [orders, reminders] = await Promise.all([
    deps.orders.forCustomer(id),
    deps.reminders.forCustomer(id),
  ]);

  return {
    orders: orders.filter((order) => order.status === "live").length,
    reminders: reminders.filter((reminder) => reminder.status === "live").length,
  };
}

// What each deleted customer took into the trash with them, for their row there
export async function deletedWithCounts(
  deps: Pick<TrashDeps, "orders" | "reminders">,
  ids: ReadonlyArray<CustomerId>,
): Promise<ReadonlyMap<CustomerId, CustomerDeletePreview>> {
  const [orders, reminders] = await Promise.all([
    deps.orders.forCustomers(ids),
    deps.reminders.forCustomers(ids),
  ]);
  const ordersWith = Map.groupBy(orders, (order) =>
    order.status === "deleted" ? order.deletedWith : undefined,
  );
  const remindersWith = Map.groupBy(reminders, (reminder) =>
    reminder.status === "deleted" ? reminder.deletedWith : undefined,
  );

  return new Map(
    ids.map((id) => [
      id,
      {
        orders: ordersWith.get(id)?.length ?? 0,
        reminders: remindersWith.get(id)?.length ?? 0,
      },
    ]),
  );
}

// Into the trash with every live order and reminder of theirs, each order's log saying so, in one batch. They come back
// together and go for good together; what was deleted before stays deleted on its own.
export async function deleteCustomer(
  deps: TrashDeps,
  input: RecordChange<CustomerId>,
): Promise<
  Result<
    ArchivedCustomer,
    Extract<
      CustomerError,
      "customer_not_found" | "customer_changed_elsewhere" | "customer_merged" | "customer_deleted"
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

  const at = deps.clock();
  const deleted = Customers.markDeleted(customer, input.by, at);
  if (!deleted.ok) {
    return deleted;
  }

  const [orders, reminders] = await Promise.all([
    deps.orders.forCustomer(customer.id),
    deps.reminders.forCustomer(customer.id),
  ]);

  // The customer first, so a change to them since they were read aborts the batch before anything else goes
  const work = deps.startUnitOfWork();
  work.customers.update(deleted.value);
  for (const order of orders.filter((each) => each.status === "live")) {
    const gone = Orders.markDeleted(order, input.by, at, customer.id);
    work.orders.update(gone, OrderChanges.record("deleted", order, gone));
  }
  for (const reminder of reminders.filter((each) => each.status === "live")) {
    work.reminders.update(Reminders.markDeleted(reminder, input.by, at, customer.id));
  }

  return (await commitUnlessStale(work)) === "stale" ? err("customer_changed_elsewhere") : deleted;
}
