import type { Customer } from "@/features/customers/domain/customer";
import type { CustomerKind } from "@/features/customers/domain/customer-kind";

// What the browser gets: plain values that cross the server-client boundary

export type KindView = {
  readonly id: string;
  readonly name: string;
  readonly hidden: boolean;
  readonly version: number;
};

export type CustomerView = {
  readonly id: string;
  readonly name: string;
  readonly kindId: string | undefined;
  readonly kindName: string | undefined;
  readonly area: string | undefined;
  readonly phone: string | undefined;
  readonly address: string | undefined;
  readonly note: string | undefined;
  readonly hidden: boolean;
  readonly version: number;
};

export function toKindView(kind: CustomerKind): KindView {
  return {
    id: kind.id,
    name: kind.name,
    hidden: kind.status === "archived",
    version: kind.audit.version,
  };
}

export function toCustomerView(
  customer: Customer,
  kinds: ReadonlyMap<string, CustomerKind>,
): CustomerView {
  return {
    id: customer.id,
    name: customer.name,
    kindId: customer.kindId,
    kindName: customer.kindId === undefined ? undefined : kinds.get(customer.kindId)?.name,
    area: customer.area,
    phone: customer.phone,
    address: customer.address,
    note: customer.note,
    hidden: customer.status === "archived",
    version: customer.audit.version,
  };
}

// The line under a customer's name in a list: what kind, and where, so two of the same name are told apart
export function customerDetail(customer: {
  readonly kindName: string | undefined;
  readonly area: string | undefined;
}): string | undefined {
  const parts = [customer.kindName, customer.area].filter((part) => part !== undefined);

  return parts.length === 0 ? undefined : parts.join(", ");
}
