import { and, inArray, isNotNull, lt, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { Temporal } from "temporal-polyfill/implementation";

import { customerAliasTable } from "@/features/customers/infrastructure/customer-alias.table";
import { customerKindTable } from "@/features/customers/infrastructure/customer-kind.table";
import { customerTable } from "@/features/customers/infrastructure/customer.table";
import { customerMergeTable } from "@/features/merging/infrastructure/customer-merge.table";
import { productMergeTable } from "@/features/merging/infrastructure/product-merge.table";
import { noteTable } from "@/features/notes/infrastructure/note.table";
import { orderChangeTable } from "@/features/orders/infrastructure/order-change.table";
import { orderLineTable } from "@/features/orders/infrastructure/order-line.table";
import { paymentTable } from "@/features/orders/infrastructure/payment.table";
import { salesOrderTable } from "@/features/orders/infrastructure/sales-order.table";
import { productAliasTable } from "@/features/products/infrastructure/product-alias.table";
import { productTable } from "@/features/products/infrastructure/product.table";
import { reminderTable } from "@/features/reminders/infrastructure/reminder.table";
import type { TrashWrites } from "@/features/trash/application/trash-writes";
import type { TrashKind } from "@/features/trash/domain/trash";
import type { Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";
import { d1MaxBoundParameters } from "@/shared/infrastructure/d1/limits";

// Deleting for good, as set-based statements on one batch. Each picks only rows still in the trash, so a thing restored
// meanwhile is left whole; what was made from a message takes the message with it once nothing else was (the
// migration's triggers), and the triggers that keep logs append-only let a log go only with its record.

// Some named ones, or every one deleted before a moment
type Which = { readonly ids: ReadonlyArray<string> } | { readonly before: number };

type Trashable = { readonly id: SQLiteColumn; readonly deletedAt: SQLiteColumn };

function picked(table: Trashable, which: Which): SQL {
  return sql`${table.deletedAt} is not null and ${
    "ids" in which ? inArray(table.id, [...which.ids]) : lt(table.deletedAt, which.before)
  }`;
}

// The rows `start` picks and every one merged into them, however long the line of merges: those merged away hold
// nothing else of their own, their orders and names having moved to the one kept
function withMergedInto(table: typeof customerTable | typeof productTable, start: SQL): SQL {
  return sql`(with recursive kept(id) as (select ${table.id} from ${table} where ${start} union select merged.id from ${table} as merged join kept on merged.merged_into_id = kept.id) select id from kept)`;
}

// `used` and every row those were merged into, up the line of merges: deleting one of those would take the used one
// with it, so none of them may go
function andWhatTheyWereMergedInto(
  table: typeof customerTable | typeof productTable,
  used: SQL,
): SQL {
  return sql`(with recursive kept(id) as (select id from (${used}) union select merged.merged_into_id from ${table} as merged join kept on merged.id = kept.id where merged.merged_into_id is not null) select id from kept)`;
}

// Every product an order line names. A merge moves lines, but a form open during it can still name the one merged
// away; the database refuses that now (order_line_names_kept_product), and older rows are left in place here.
const productsInUse = andWhatTheyWereMergedInto(
  productTable,
  sql`select ${orderLineTable.productId} as id from ${orderLineTable}`,
);

// Every customer with a live order or reminder, and every one merged away that still has any order or reminder at
// all - an order placed while the merge ran
const customersInUse = andWhatTheyWereMergedInto(
  customerTable,
  sql`select ${salesOrderTable.customerId} as id from ${salesOrderTable} where ${salesOrderTable.deletedAt} is null union select ${reminderTable.customerId} from ${reminderTable} where ${reminderTable.deletedAt} is null and ${reminderTable.customerId} is not null union select owner.id from ${customerTable} as owner where owner.merged_into_id is not null and (exists (select 1 from ${salesOrderTable} where ${salesOrderTable.customerId} = owner.id) or exists (select 1 from ${reminderTable} where ${reminderTable.customerId} = owner.id))`,
);

export function createTrashWrites(db: Database, batch: Batch): TrashWrites {
  // An order goes with its log, payments and lines
  function orders(where: SQL) {
    const going = db.select({ id: salesOrderTable.id }).from(salesOrderTable).where(where);
    batch.enlist(db.delete(orderChangeTable).where(inArray(orderChangeTable.orderId, going)));
    batch.enlist(db.delete(paymentTable).where(inArray(paymentTable.orderId, going)));
    batch.enlist(db.delete(orderLineTable).where(inArray(orderLineTable.orderId, going)));
    batch.enlist(db.delete(salesOrderTable).where(where));
  }

  // A customer goes with every order and reminder of theirs still in the trash, their other names, and the customers
  // merged into them. One still in use - a live order or reminder restored on its own meanwhile, or one of those merged
  // into them still holding something - stays.
  function customers(which: Which) {
    const start = sql`${picked(customerTable, which)} and ${customerTable.id} not in ${customersInUse}`;
    const going = db.select({ id: customerTable.id }).from(customerTable).where(start);
    orders(
      sql`${inArray(salesOrderTable.customerId, going)} and ${isNotNull(salesOrderTable.deletedAt)}`,
    );
    batch.enlist(
      db
        .delete(reminderTable)
        .where(and(inArray(reminderTable.customerId, going), isNotNull(reminderTable.deletedAt))),
    );
    const line = withMergedInto(customerTable, start);
    batch.enlist(
      db.delete(customerAliasTable).where(sql`${customerAliasTable.customerId} in ${line}`),
    );
    batch.enlist(db.delete(customerMergeTable).where(sql`${customerMergeTable.intoId} in ${line}`));
    batch.enlist(db.delete(customerTable).where(sql`${customerTable.id} in ${line}`));
  }

  // A product no order line names - the delete refused any other - with its other names and the products merged into
  // it, when none of those is named either
  function products(which: Which) {
    const start = sql`${picked(productTable, which)} and ${productTable.id} not in ${productsInUse}`;
    const line = withMergedInto(productTable, start);
    batch.enlist(
      db.delete(productAliasTable).where(sql`${productAliasTable.productId} in ${line}`),
    );
    batch.enlist(db.delete(productMergeTable).where(sql`${productMergeTable.intoId} in ${line}`));
    batch.enlist(db.delete(productTable).where(sql`${productTable.id} in ${line}`));
  }

  // Its customers are left with no kind, a change by whoever deleted it
  function kinds(which: Which, at: Temporal.Instant) {
    const going = db
      .select({ id: customerKindTable.id })
      .from(customerKindTable)
      .where(picked(customerKindTable, which));
    batch.enlist(
      db
        .update(customerTable)
        .set({
          kindId: null,
          version: sql`${customerTable.version} + 1`,
          updatedAt: at.epochMilliseconds,
          updatedBy: sql`(select ${customerKindTable.deletedBy} from ${customerKindTable} where ${customerKindTable.id} = ${customerTable.kindId})`,
        })
        .where(inArray(customerTable.kindId, going)),
    );
    batch.enlist(db.delete(customerKindTable).where(picked(customerKindTable, which)));
  }

  function purgeKind(kind: TrashKind, which: Which, at: Temporal.Instant) {
    switch (kind) {
      case "note":
        batch.enlist(db.delete(noteTable).where(picked(noteTable, which)));
        return;
      case "reminder":
        batch.enlist(db.delete(reminderTable).where(picked(reminderTable, which)));
        return;
      case "order":
        orders(picked(salesOrderTable, which));
        return;
      case "customer":
        customers(which);
        return;
      case "product":
        products(which);
        return;
      case "kind":
        kinds(which, at);
        return;
    }
  }

  return {
    // One statement binds `at` beside the ids (the kinds' customers), so a chunk leaves it room
    purge(kind, ids, at) {
      const size = d1MaxBoundParameters - 1;
      for (let start = 0; start < ids.length; start += size) {
        purgeKind(kind, { ids: ids.slice(start, start + size) }, at);
      }
    },

    purgeDeletedBefore(kind, before, at) {
      purgeKind(kind, { before: before.epochMilliseconds }, at);
    },
  };
}
