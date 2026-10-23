import {
  customerIdSchema,
  customerLimits,
  type Customer,
} from "@/features/customers/domain/customer";
import { customerKindIdSchema } from "@/features/customers/domain/customer-kind";
import { searchText } from "@/shared/domain/search-text";
import { optionalTextSchema, requiredTextSchema } from "@/shared/domain/short-text";
import {
  toArchival,
  toArchivalRow,
  toAudit,
  toAuditRow,
} from "@/shared/infrastructure/d1/audit-mapping";

import type { customerTable } from "./customer.table";

type CustomerRow = typeof customerTable.$inferSelect;

const nameSchema = requiredTextSchema(customerLimits.name, { empty: "name", tooLong: "name" });

// Rows are parsed back, so a value that slipped past the database's checks fails here rather than on a screen
export function toCustomer(row: CustomerRow): Customer {
  const fields = {
    id: customerIdSchema.parse(row.id),
    name: nameSchema.parse(row.name),
    kindId: row.kindId === null ? undefined : customerKindIdSchema.parse(row.kindId),
    area: optionalTextSchema(customerLimits.area, "area").parse(row.area ?? ""),
    phone: optionalTextSchema(customerLimits.phone, "phone").parse(row.phone ?? ""),
    address: optionalTextSchema(customerLimits.address, "address").parse(row.address ?? ""),
    note: optionalTextSchema(customerLimits.note, "note").parse(row.note ?? ""),
    audit: toAudit(row),
  };
  const archival = toArchival(row);

  return archival === undefined
    ? { ...fields, status: "active" }
    : { ...fields, status: "archived", archival };
}

export function toCustomerRow(customer: Customer): CustomerRow {
  return {
    id: customer.id,
    name: customer.name,
    searchName: customerSearchName(customer.name, customer.area),
    kindId: customer.kindId ?? null,
    area: customer.area ?? null,
    phone: customer.phone ?? null,
    address: customer.address ?? null,
    note: customer.note ?? null,
    ...toAuditRow(customer.audit),
    ...toArchivalRow(customer.status === "archived" ? customer.archival : undefined),
  };
}

// The name first, so sorting by it sorts by name; the area after it, so a search finds "Hoà Bình, quận 3" by either
export function customerSearchName(name: string, area: string | undefined): string {
  return searchText(area === undefined ? name : `${name} ${area}`);
}
