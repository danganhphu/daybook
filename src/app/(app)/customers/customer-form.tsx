"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";

import { addCustomer, reviseCustomer } from "@/app/(app)/customers/actions";
import { customerLimits } from "@/features/customers/domain/customer";
import type { CustomerFormState } from "@/features/customers/web/commands";
import type { CustomerView, KindView } from "@/features/customers/web/customer-view";
import { customersCopy } from "@/features/customers/web/customers-copy";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { SelectField } from "@/shared/ui/select-field/select-field";
import { TextArea } from "@/shared/ui/text-area/text-area";
import { TextField } from "@/shared/ui/text-field/text-field";

import styles from "./customer-form.module.scss";

export type CustomerFormProps = {
  // Empty for a new customer
  readonly customer: CustomerView | undefined;
  readonly kinds: ReadonlyArray<KindView>;
};

const noState: CustomerFormState = {};

// One customer's details. A plain form posting to a server action, so it works before the page's scripts have
// loaded; only the name is required.
export function CustomerForm({ customer, kinds }: CustomerFormProps) {
  // The customer's page on success, or the form again with the reasons
  const save = useMemo(
    () => (customer === undefined ? addCustomer : reviseCustomer.bind(null, customer.id)),
    [customer],
  );
  const [state, action, pending] = useActionState(save, noState);
  const options = useMemo(
    () => kinds.map((kind) => ({ value: kind.id, label: kind.name })),
    [kinds],
  );
  const value = (field: keyof NonNullable<CustomerFormState["values"]>) =>
    state.values?.[field] ?? customer?.[field] ?? "";
  const form = useRef<HTMLFormElement>(null);

  // A refused save moves the focus to the first field it names, whose error is then read out with it
  useEffect(() => {
    if (state.fieldErrors !== undefined) {
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  return (
    <form ref={form} action={action} className={styles.form} noValidate>
      {customer === undefined ? null : (
        <input type="hidden" name="version" value={customer.version} />
      )}
      <TextField
        label={customersCopy.fields.name}
        name="name"
        defaultValue={value("name")}
        error={state.fieldErrors?.name}
        maxLength={customerLimits.name}
        autoComplete="off"
        required
      />
      <SelectField
        label={customersCopy.fields.kind}
        name="kindId"
        options={options}
        emptyLabel={customersCopy.noKind}
        defaultValue={value("kindId")}
        error={state.fieldErrors?.kindId}
      />
      <TextField
        label={customersCopy.fields.area}
        name="area"
        defaultValue={value("area")}
        error={state.fieldErrors?.area}
        maxLength={customerLimits.area}
      />
      <TextField
        label={customersCopy.fields.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        defaultValue={value("phone")}
        error={state.fieldErrors?.phone}
        maxLength={customerLimits.phone}
        autoComplete="off"
      />
      <TextField
        label={customersCopy.fields.address}
        name="address"
        defaultValue={value("address")}
        error={state.fieldErrors?.address}
        maxLength={customerLimits.address}
      />
      <label className={styles.noteLabel}>
        <span>{customersCopy.fields.note}</span>
        <TextArea name="note" defaultValue={value("note")} maxLength={customerLimits.note} />
      </label>
      {state.fieldErrors?.note === undefined ? null : (
        <p role="alert" className={styles.error}>
          {state.fieldErrors.note}
        </p>
      )}

      {state.error === undefined ? null : (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? actionLabels.saving : actionLabels.save}
      </Button>
    </form>
  );
}
