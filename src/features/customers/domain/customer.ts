import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";
import type { Archival, Audit } from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";
import { optionalTextSchema, requiredTextSchema } from "@/shared/domain/short-text";

import { customerKindIdSchema } from "./customer-kind";
import { customerLimits } from "./customer-limits";

// Read as a module: `import * as Customers`

export const customerIdSchema = z.uuid().brand<"CustomerId">();

export type CustomerId = z.infer<typeof customerIdSchema>;

// A customer's name, and any other name they are known by
export const customerNameSchema = requiredTextSchema(customerLimits.name, {
  empty: "Chưa nhập tên khách",
  tooLong: `Tên khách tối đa ${customerLimits.name} ký tự`,
});

// What the form holds. Two customers may share a name; the area beneath it tells them apart in a list.
export const customerDetailsSchema = z.object({
  name: customerNameSchema,
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
  // The customer it was merged into, when a merge hid it; its orders went there
  readonly mergedInto: CustomerId | undefined;
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
    mergedInto: undefined,
  });
}

// A merged customer stays hidden: its orders and reminders belong to the one it was merged into now
export function restore(
  customer: Customer,
  by: AccountId,
  at: Temporal.Instant,
): Result<ActiveCustomer, "customer_not_archived" | "customer_merged"> {
  if (customer.status === "active") {
    return err("customer_not_archived");
  }
  if (customer.mergedInto !== undefined) {
    return err("customer_merged");
  }

  const { archival: _archival, mergedInto: _mergedInto, ...fields } = customer;

  return ok({ ...fields, status: "active", audit: Audits.change(customer.audit, by, at) });
}

// Hidden for good, naming the customer kept in its place. One already merged cannot be merged again; a hidden one
// can, which is how a duplicate hidden earlier is joined to the real one.
export function mergeInto(
  customer: Customer,
  into: ActiveCustomer,
  by: AccountId,
  at: Temporal.Instant,
): Result<ArchivedCustomer, "customer_merged" | "merge_into_itself"> {
  if (customer.id === into.id) {
    return err("merge_into_itself");
  }
  if (customer.status === "archived" && customer.mergedInto !== undefined) {
    return err("customer_merged");
  }

  return ok({
    ...customer,
    status: "archived",
    audit: Audits.change(customer.audit, by, at),
    archival: customer.status === "archived" ? customer.archival : Audits.archival(by, at),
    mergedInto: into.id,
  });
}

// The kept customer gains orders and names in a merge; its version moves, so a change to it from a screen opened
// before the merge is refused, and two merges into it cannot interleave
export function absorbMerge(
  customer: ActiveCustomer,
  by: AccountId,
  at: Temporal.Instant,
): ActiveCustomer {
  return { ...customer, audit: Audits.change(customer.audit, by, at) };
}
