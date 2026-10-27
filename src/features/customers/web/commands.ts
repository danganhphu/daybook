import type { App } from "@/composition/create-app";
import {
  customerErrorMessages,
  type CustomerError,
} from "@/features/customers/application/customer-errors";
import {
  customerDetailsSchema,
  customerIdSchema,
  customerNameSchema,
  type Customer,
  type CustomerDetails,
} from "@/features/customers/domain/customer";
import { customerAliasIdSchema } from "@/features/customers/domain/customer-alias";
import {
  customerKindIdSchema,
  kindNameSchema,
  type CustomerKind,
} from "@/features/customers/domain/customer-kind";
import type { AccountId } from "@/shared/domain/account-id";
import { versionSchema } from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";
import { searchTermSchema } from "@/shared/domain/search-term";
import { fieldErrors, formValues, type FormState } from "@/shared/web/form-state";
import type { OtherNameView } from "@/shared/web/other-name-view";

import {
  customerDetail,
  toCustomerView,
  toKindView,
  type CustomerView,
  type KindView,
} from "./customer-view";

// The customer screens' work, minus the framework: parse what the browser sent, call the app, answer with a view or
// the sentences the user reads. Server actions and pages wrap these; tests call them directly.

export const customerFields = ["name", "kindId", "area", "phone", "address", "note"] as const;

export type CustomerField = (typeof customerFields)[number];

export type CustomerFormState = FormState<CustomerField>;

export type CustomerRow = {
  readonly id: string;
  readonly name: string;
  readonly detail: string | undefined;
  readonly owed: number;
};

export type CustomersView = {
  // As typed, to fill the box again
  readonly query: string;
  readonly kindId: string;
  readonly showingHidden: boolean;
  // Active kinds, for the filter
  readonly kinds: ReadonlyArray<KindView>;
  readonly rows: ReadonlyArray<CustomerRow>;
  readonly more: boolean;
  // Whether any filter is on, so an empty list can say "none found" rather than "none yet"
  readonly filtered: boolean;
};

function kindsById(kinds: ReadonlyArray<CustomerKind>) {
  return new Map<string, CustomerKind>(kinds.map((kind) => [kind.id, kind]));
}

export async function customersScreen(
  app: App,
  params: { readonly q?: unknown; readonly kind?: unknown; readonly hidden?: unknown },
): Promise<CustomersView> {
  const query = typeof params.q === "string" ? params.q : "";
  const term = searchTermSchema.safeParse(query);
  const kind = customerKindIdSchema.safeParse(params.kind);
  const showingHidden = params.hidden === "1";

  const [kinds, found, owed] = await Promise.all([
    app.listCustomerKinds(),
    app.listCustomers({
      search: term.success ? term.data : undefined,
      kindId: kind.success ? kind.data : undefined,
      status: showingHidden ? "archived" : "active",
    }),
    app.owedByCustomer(),
  ]);
  const byId = kindsById(kinds);

  return {
    query,
    kindId: kind.success ? kind.data : "",
    showingHidden,
    kinds: kinds.filter((each) => each.status === "active").map(toKindView),
    rows: found.customers.map((customer) => {
      const view = toCustomerView(customer, byId);
      return {
        id: view.id,
        name: view.name,
        detail: customerDetail(view),
        owed: owed.get(customer.id) ?? 0,
      };
    }),
    more: found.more,
    filtered: term.success || kind.success,
  };
}

export type CustomerScreenView = CustomerView & {
  readonly orderCount: number;
  readonly total: number;
  readonly owed: number;
  // YYYY-MM-DD
  readonly lastOrderedOn: string | undefined;
  // The customer it was merged into: hidden for good, its orders are there now
  readonly mergedInto: string | undefined;
  readonly otherNames: ReadonlyArray<OtherNameView>;
};

export async function customerScreen(
  app: App,
  id: unknown,
): Promise<CustomerScreenView | undefined> {
  const customerId = customerIdSchema.safeParse(id);
  if (!customerId.success) {
    return undefined;
  }

  const [customer, kinds, account, aliases] = await Promise.all([
    app.getCustomer(customerId.data),
    app.listCustomerKinds(),
    app.customerAccount(customerId.data),
    app.customerAliases(customerId.data),
  ]);
  if (customer === undefined) {
    return undefined;
  }

  return {
    ...toCustomerView(customer, kindsById(kinds)),
    orderCount: account.orderCount,
    total: account.total,
    owed: account.owed,
    lastOrderedOn: account.lastOrderedOn?.toString(),
    mergedInto: customer.status === "archived" ? customer.mergedInto : undefined,
    otherNames: aliases.map((alias) => ({ id: alias.id, name: alias.name })),
  };
}

export async function addCustomerAlias(
  app: App,
  by: AccountId,
  customerId: unknown,
  name: unknown,
): Promise<Result<null, string>> {
  const id = customerIdSchema.safeParse(customerId);
  if (!id.success) {
    return err(customerErrorMessages.customer_not_found);
  }
  const parsed = customerNameSchema.safeParse(name);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? customerErrorMessages.customer_not_found);
  }

  const added = await app.addCustomerAlias({ by, customerId: id.data, name: parsed.data });

  return added.ok ? ok(null) : err(customerErrorMessages[added.error]);
}

export async function removeCustomerAlias(
  app: App,
  aliasId: unknown,
): Promise<Result<null, string>> {
  const id = customerAliasIdSchema.safeParse(aliasId);
  if (!id.success) {
    return err(customerErrorMessages.alias_not_found);
  }

  const removed = await app.removeCustomerAlias(id.data);

  return removed.ok ? ok(null) : err(customerErrorMessages[removed.error]);
}

// The form for one customer, new or existing: its values, and the kinds it may pick - the active ones, and the
// customer's own even if hidden since
export type CustomerFormView = {
  readonly customer: CustomerView | undefined;
  readonly kinds: ReadonlyArray<KindView>;
};

export async function customerForm(app: App, id?: unknown): Promise<CustomerFormView | undefined> {
  const kinds = await app.listCustomerKinds();
  const byId = kindsById(kinds);
  if (id === undefined) {
    return {
      customer: undefined,
      kinds: kinds.filter((kind) => kind.status === "active").map(toKindView),
    };
  }

  const customerId = customerIdSchema.safeParse(id);
  const customer = customerId.success ? await app.getCustomer(customerId.data) : undefined;
  if (customer === undefined) {
    return undefined;
  }

  return {
    customer: toCustomerView(customer, byId),
    kinds: kinds
      .filter((kind) => kind.status === "active" || kind.id === customer.kindId)
      .map(toKindView),
  };
}

function parseDetails(form: FormData): Result<CustomerDetails, CustomerFormState> {
  const values = formValues(form, customerFields);
  const parsed = customerDetailsSchema.safeParse({
    ...values,
    kindId: values.kindId === "" ? undefined : values.kindId,
  });

  return parsed.success
    ? ok(parsed.data)
    : err({ fieldErrors: fieldErrors(parsed.error, customerFields), values });
}

function refusal(error: CustomerError, form: FormData): CustomerFormState {
  const values = formValues(form, customerFields);
  const message = customerErrorMessages[error];

  return error === "kind_not_found" || error === "kind_archived"
    ? { fieldErrors: { kindId: message }, values }
    : { error: message, values };
}

// Answers the new customer's id, or what to show on the form
export async function addCustomer(
  app: App,
  by: AccountId,
  form: FormData,
): Promise<Result<string, CustomerFormState>> {
  const details = parseDetails(form);
  if (!details.ok) {
    return details;
  }

  const added = await app.addCustomer({ by, details: details.value });

  return added.ok ? ok(added.value.id) : err(refusal(added.error, form));
}

export async function reviseCustomer(
  app: App,
  by: AccountId,
  id: unknown,
  form: FormData,
): Promise<Result<string, CustomerFormState>> {
  const customerId = customerIdSchema.safeParse(id);
  const shown = versionSchema.safeParse(Number(form.get("version")));
  if (!customerId.success || !shown.success) {
    return err({ error: customerErrorMessages.customer_not_found });
  }

  const details = parseDetails(form);
  if (!details.ok) {
    return details;
  }

  const revised = await app.reviseCustomer({
    id: customerId.data,
    by,
    shown: shown.data,
    details: details.value,
  });

  return revised.ok ? ok(revised.value.id) : err(refusal(revised.error, form));
}

export type CustomerResult = Result<CustomerView, string>;

async function toResult(
  app: App,
  result: Result<Customer, CustomerError>,
): Promise<CustomerResult> {
  return result.ok
    ? ok(toCustomerView(result.value, kindsById(await app.listCustomerKinds())))
    : err(customerErrorMessages[result.error]);
}

function parseChange(by: AccountId, id: unknown, version: unknown) {
  const customerId = customerIdSchema.safeParse(id);
  const shown = versionSchema.safeParse(version);

  return customerId.success && shown.success
    ? { id: customerId.data, by, shown: shown.data }
    : undefined;
}

export async function archiveCustomer(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
): Promise<CustomerResult> {
  const change = parseChange(by, id, version);

  return change === undefined
    ? err(customerErrorMessages.customer_not_found)
    : toResult(app, await app.archiveCustomer(change));
}

export async function restoreCustomer(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
): Promise<CustomerResult> {
  const change = parseChange(by, id, version);

  return change === undefined
    ? err(customerErrorMessages.customer_not_found)
    : toResult(app, await app.restoreCustomer(change));
}

// Kinds, for Settings

export async function kindsView(app: App): Promise<ReadonlyArray<KindView>> {
  return (await app.listCustomerKinds()).map(toKindView);
}

export type KindResult = Result<KindView, string>;

function toKindResult(result: Result<CustomerKind, CustomerError>): KindResult {
  return result.ok ? ok(toKindView(result.value)) : err(customerErrorMessages[result.error]);
}

export async function addKind(app: App, by: AccountId, name: unknown): Promise<KindResult> {
  const parsed = kindNameSchema.safeParse(name);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? customerErrorMessages.kind_not_found);
  }

  return toKindResult(await app.addCustomerKind({ by, name: parsed.data }));
}

function parseKindChange(by: AccountId, id: unknown, version: unknown) {
  const kindId = customerKindIdSchema.safeParse(id);
  const shown = versionSchema.safeParse(version);

  return kindId.success && shown.success ? { id: kindId.data, by, shown: shown.data } : undefined;
}

export async function renameKind(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
  name: unknown,
): Promise<KindResult> {
  const change = parseKindChange(by, id, version);
  if (change === undefined) {
    return err(customerErrorMessages.kind_not_found);
  }
  const parsed = kindNameSchema.safeParse(name);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? customerErrorMessages.kind_not_found);
  }

  return toKindResult(await app.renameCustomerKind({ ...change, name: parsed.data }));
}

export async function hideKind(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
): Promise<KindResult> {
  const change = parseKindChange(by, id, version);

  return change === undefined
    ? err(customerErrorMessages.kind_not_found)
    : toKindResult(await app.archiveCustomerKind(change));
}

export async function showKind(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
): Promise<KindResult> {
  const change = parseKindChange(by, id, version);

  return change === undefined
    ? err(customerErrorMessages.kind_not_found)
    : toKindResult(await app.restoreCustomerKind(change));
}
