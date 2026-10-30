import * as Customers from "@/features/customers/domain/customer";
import type { CustomerId } from "@/features/customers/domain/customer";
import * as CustomerKinds from "@/features/customers/domain/customer-kind";
import * as Notes from "@/features/notes/domain/note";
import * as Orders from "@/features/orders/domain/order";
import * as OrderChanges from "@/features/orders/domain/order-change";
import * as Products from "@/features/products/domain/product";
import * as Reminders from "@/features/reminders/domain/reminder";
import { itemsOf, type TrashItem } from "@/features/trash/domain/trash";
import { commitUnlessStale } from "@/shared/application/stale-write";
import type { AccountId } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";
import { searchText } from "@/shared/domain/search-text";

import type { TrashDeps } from "./trash-deps";
import type { TrashError } from "./trash-errors";
import { asShown, byId, distinct, type TrashOutcome, type TrashRefusal } from "./trash-outcome";

// Back where each was, all in one batch: a customer with the orders and reminders deleted with them. What cannot come
// back is said and the rest still does - an order whose customer is still deleted, a product or kind whose name a
// shown one took meanwhile. About a dozen reads whatever is chosen, under D1's fifty per request.
export async function restoreFromTrash(
  deps: TrashDeps,
  by: AccountId,
  chosen: ReadonlyArray<TrashItem>,
): Promise<Result<TrashOutcome, "trash_changed_elsewhere">> {
  const items = distinct(chosen);
  const customerIds = itemsOf(items, "customer").map((item) => item.id);
  const [notes, orders, reminders, customers, products, kinds, theirOrders, theirReminders] =
    await Promise.all([
      deps.notes.getMany(itemsOf(items, "note").map((item) => item.id)),
      deps.orders.getMany(itemsOf(items, "order").map((item) => item.id)),
      deps.reminders.getMany(itemsOf(items, "reminder").map((item) => item.id)),
      deps.customers.getMany(customerIds),
      deps.products.getMany(itemsOf(items, "product").map((item) => item.id)),
      deps.kinds.getMany(itemsOf(items, "kind").map((item) => item.id)),
      deps.orders.forCustomers(customerIds),
      deps.reminders.forCustomers(customerIds),
    ]);
  const ownerIds = [
    ...new Set(
      [...orders, ...reminders].flatMap((each) =>
        each.customerId === undefined ? [] : [each.customerId],
      ),
    ),
  ];
  const [owners, shownProducts, shownKinds] = await Promise.all([
    deps.customers.getMany(ownerIds),
    deps.products.findActiveNamed(products.map((product) => product.name)),
    kinds.length === 0 ? [] : deps.kinds.list(),
  ]);

  const at = deps.clock();
  const work = deps.startUnitOfWork();
  const refused: TrashRefusal[] = [];
  let done = 0;
  const refuse = (item: TrashItem, error: TrashError) => refused.push({ item, error });

  // Customers first: what comes back with them is not asked for again, and their orders may come back after them
  const backCustomers = new Set<CustomerId>();
  const backWith = new Set<string>();
  const customersById = byId(customers);
  for (const item of itemsOf(items, "customer")) {
    const customer = asShown(item, customersById.get(item.id));
    if (typeof customer === "string") {
      refuse(item, customer);
      continue;
    }
    const restored = Customers.restoreDeleted(customer, by, at);
    if (!restored.ok) {
      refuse(item, "trash_not_deleted");
      continue;
    }
    work.customers.update(restored.value);
    for (const order of theirOrders) {
      const live =
        order.status === "deleted" && order.deletedWith === customer.id
          ? Orders.restore(order, by, at, customer.id)
          : undefined;
      if (live?.ok === true) {
        work.orders.update(live.value, OrderChanges.record("restored", order, live.value));
        backWith.add(order.id);
      }
    }
    for (const reminder of theirReminders) {
      const live =
        reminder.status === "deleted" && reminder.deletedWith === customer.id
          ? Reminders.restore(reminder, by, at, customer.id)
          : undefined;
      if (live?.ok === true) {
        work.reminders.update(live.value);
        backWith.add(reminder.id);
      }
    }
    backCustomers.add(customer.id);
    done += 1;
  }

  const ownersById = byId(owners);
  const ownerDeleted = (customerId: CustomerId | undefined) => {
    const owner = customerId === undefined ? undefined : ownersById.get(customerId);
    return (
      owner?.status === "archived" && owner.deletion !== undefined && !backCustomers.has(owner.id)
    );
  };

  const ordersById = byId(orders);
  for (const item of itemsOf(items, "order")) {
    if (backWith.has(item.id)) {
      continue;
    }
    const order = asShown(item, ordersById.get(item.id));
    if (typeof order === "string") {
      refuse(item, order);
      continue;
    }
    if (ownerDeleted(order.customerId)) {
      refuse(item, "trash_customer_deleted");
      continue;
    }
    const live = Orders.restore(order, by, at);
    if (!live.ok) {
      refuse(
        item,
        live.error === "order_deleted_with_customer"
          ? "trash_customer_deleted"
          : "trash_not_deleted",
      );
      continue;
    }
    work.orders.update(live.value, OrderChanges.record("restored", order, live.value));
    done += 1;
  }

  const remindersById = byId(reminders);
  for (const item of itemsOf(items, "reminder")) {
    if (backWith.has(item.id)) {
      continue;
    }
    const reminder = asShown(item, remindersById.get(item.id));
    if (typeof reminder === "string") {
      refuse(item, reminder);
      continue;
    }
    if (ownerDeleted(reminder.customerId)) {
      refuse(item, "trash_customer_deleted");
      continue;
    }
    const live = Reminders.restore(reminder, by, at);
    if (!live.ok) {
      refuse(
        item,
        live.error === "reminder_deleted_with_customer"
          ? "trash_customer_deleted"
          : "trash_not_deleted",
      );
      continue;
    }
    work.reminders.update(live.value);
    done += 1;
  }

  const notesById = byId(notes);
  for (const item of itemsOf(items, "note")) {
    const note = asShown(item, notesById.get(item.id));
    if (typeof note === "string") {
      refuse(item, note);
      continue;
    }
    const live = Notes.restore(note, by, at);
    if (!live.ok) {
      refuse(item, "trash_not_deleted");
      continue;
    }
    work.notes.update(live.value);
    done += 1;
  }

  // Two shown products never share a name, nor two shown kinds: not with one shown now, nor with another restored here
  const productNames = new Set<string>();
  const productsById = byId(products);
  for (const item of itemsOf(items, "product")) {
    const product = asShown(item, productsById.get(item.id));
    if (typeof product === "string") {
      refuse(item, product);
      continue;
    }
    const restored = Products.restoreDeleted(product, by, at);
    if (!restored.ok) {
      refuse(item, "trash_not_deleted");
      continue;
    }
    const name = searchText(product.name);
    const holder = shownProducts.get(name);
    if ((holder !== undefined && holder.id !== product.id) || productNames.has(name)) {
      refuse(item, "trash_name_taken");
      continue;
    }
    productNames.add(name);
    work.products.update(restored.value);
    done += 1;
  }

  const kindNames = new Set(
    shownKinds.filter((kind) => kind.status === "active").map((kind) => searchText(kind.name)),
  );
  const kindsById = byId(kinds);
  for (const item of itemsOf(items, "kind")) {
    const kind = asShown(item, kindsById.get(item.id));
    if (typeof kind === "string") {
      refuse(item, kind);
      continue;
    }
    const restored = CustomerKinds.restoreDeleted(kind, by, at);
    if (!restored.ok) {
      refuse(item, "trash_not_deleted");
      continue;
    }
    const name = searchText(kind.name);
    if (kindNames.has(name)) {
      refuse(item, "trash_name_taken");
      continue;
    }
    kindNames.add(name);
    work.customerKinds.update(restored.value);
    done += 1;
  }

  if (done === 0) {
    return ok({ done, refused });
  }

  return (await commitUnlessStale(work)) === "stale"
    ? err("trash_changed_elsewhere")
    : ok({ done, refused });
}
