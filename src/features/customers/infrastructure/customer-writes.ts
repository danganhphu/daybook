import { eq } from "drizzle-orm";

import type {
  CustomerKindWrites,
  CustomerWrites,
} from "@/features/customers/application/customer-writes";
import type { Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toCustomerKindRow } from "./customer-kind-mapping";
import { customerKindTable } from "./customer-kind.table";
import { toCustomerRow } from "./customer-mapping";
import { customerTable } from "./customer.table";

// Updates set everything but the creation, which the database refuses to change; the version trigger refuses a
// stale write

export function createCustomerKindWrites(db: Database, batch: Batch): CustomerKindWrites {
  return {
    add(kind) {
      batch.enlist(db.insert(customerKindTable).values(toCustomerKindRow(kind)));
    },

    update(kind) {
      const {
        id: _id,
        createdAt: _createdAt,
        createdBy: _createdBy,
        ...changes
      } = toCustomerKindRow(kind);
      batch.enlist(
        db.update(customerKindTable).set(changes).where(eq(customerKindTable.id, kind.id)),
      );
    },
  };
}

export function createCustomerWrites(db: Database, batch: Batch): CustomerWrites {
  return {
    add(customer) {
      batch.enlist(db.insert(customerTable).values(toCustomerRow(customer)));
    },

    update(customer) {
      const {
        id: _id,
        createdAt: _createdAt,
        createdBy: _createdBy,
        ...changes
      } = toCustomerRow(customer);
      batch.enlist(db.update(customerTable).set(changes).where(eq(customerTable.id, customer.id)));
    },
  };
}
