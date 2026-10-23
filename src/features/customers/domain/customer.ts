import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";
import type { Archival, Audit } from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";
import { optionalTextSchema, requiredTextSchema } from "@/shared/domain/short-text";

import { customerKindIdSchema } from "./customer-kind";

// Read as a module: `import * as Customers`

export const customerIdSchema = z.uuid().brand<"CustomerId">();

export type CustomerId = z.infer<typeof customerIdSchema>;

export const customerLimits = {
  name: 100,
  area: 60,
  phone: 20,
  address: 200,
  note: 1000,
} as const;

// What the form holds. Two customers may share a name; the area beneath it tells them apart in a list.
export const customerDetailsSchema = z.object({
  name: requiredTextSchema(customerLimits.name, {
    empty: "Chưa nhập tên khách",
    tooLong: `Tên khách tối đa ${customerLimits.name} ký tự`,
  }),
  kindId: customerKindIdSchema.optional(),
  area: optionalTextSchema(customerLimits.area, `Khu vực tối đa ${customerLimits.area} ký tự`),
  phone: optionalTextSchema(
    customerLimits.phone,
    `Số điện thoại tối đa ${customerLimits.phone} ký tự`,
  ).refine((phone) => phone === undefined || /^[0-9+().\s-]+$/.test(phone), {
    error: "Số điện thoại chỉ gồm số",
  }),
  address: optionalTextSchema(
    customerLimits.address,
    `Địa chỉ tối đa ${customerLimits.address} ký tự`,
  ),
  note: optionalTextSchema(customerLimits.note, `Ghi chú tối đa ${customerLimits.note} ký tự`),
});

export type CustomerDetails = z.infer<typeof customerDetailsSchema>;

type CustomerFields = CustomerDetails & {
  readonly id: CustomerId;
  readonly audit: Audit;
};

export type ActiveCustomer = CustomerFields & { readonly status: "active" };

export type ArchivedCustomer = CustomerFields & {
  readonly status: "archived";
  readonly archival: Archival;
};

export type Customer = ActiveCustomer | ArchivedCustomer;

export function create(
  details: CustomerDetails,
  by: AccountId,
  at: Temporal.Instant,
): ActiveCustomer {
  return {
    status: "active",
    id: customerIdSchema.parse(uuidv7()),
    ...details,
    audit: Audits.start(by, at),
  };
}

export function revise(
  customer: Customer,
  details: CustomerDetails,
  by: AccountId,
  at: Temporal.Instant,
): Customer {
  return { ...customer, ...details, audit: Audits.change(customer.audit, by, at) };
}

// Never deleted: old orders still show who they were for. Archived, the customer leaves the list and the order form.
export function archive(
  customer: Customer,
  by: AccountId,
  at: Temporal.Instant,
): Result<ArchivedCustomer, "customer_archived"> {
  if (customer.status === "archived") {
    return err("customer_archived");
  }

  return ok({
    ...customer,
    status: "archived",
    audit: Audits.change(customer.audit, by, at),
    archival: Audits.archival(by, at),
  });
}

export function restore(
  customer: Customer,
  by: AccountId,
  at: Temporal.Instant,
): Result<ActiveCustomer, "customer_not_archived"> {
  if (customer.status === "active") {
    return err("customer_not_archived");
  }

  const { archival: _archival, ...fields } = customer;

  return ok({ ...fields, status: "active", audit: Audits.change(customer.audit, by, at) });
}
