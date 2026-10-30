import {
  customerKindIdSchema,
  kindNameSchema,
  positionSchema,
  type CustomerKind,
} from "@/features/customers/domain/customer-kind";
import { searchText } from "@/shared/domain/search-text";
import {
  toArchival,
  toArchivalRow,
  toAudit,
  toAuditRow,
  toDeletion,
  toDeletionRow,
} from "@/shared/infrastructure/d1/audit-mapping";

import type { customerKindTable } from "./customer-kind.table";

type CustomerKindRow = typeof customerKindTable.$inferSelect;

export function toCustomerKind(row: CustomerKindRow): CustomerKind {
  const fields = {
    id: customerKindIdSchema.parse(row.id),
    name: kindNameSchema.parse(row.name),
    position: positionSchema.parse(row.position),
    audit: toAudit(row),
  };
  const archival = toArchival(row);

  return archival === undefined
    ? { ...fields, status: "active" }
    : { ...fields, status: "archived", archival, deletion: toDeletion(row) };
}

export function toCustomerKindRow(kind: CustomerKind): CustomerKindRow {
  return {
    id: kind.id,
    name: kind.name,
    searchName: searchText(kind.name),
    position: kind.position,
    ...toAuditRow(kind.audit),
    ...toArchivalRow(kind.status === "archived" ? kind.archival : undefined),
    ...toDeletionRow(kind.status === "archived" ? kind.deletion : undefined),
  };
}
