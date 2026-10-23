"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useState, type ChangeEvent, type FormEvent } from "react";

import { findCustomers, findProducts, placeOrder, reviseOrder } from "@/app/(app)/orders/actions";
import type { CustomerSuggestion, OrderFormView } from "@/features/orders/web/order-view";
import { ordersCopy } from "@/features/orders/web/orders-copy";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { AddIcon } from "@/shared/ui/icon/icons";
import { SuggestField } from "@/shared/ui/suggest-field/suggest-field";
import { TextArea } from "@/shared/ui/text-area/text-area";
import { TextField } from "@/shared/ui/text-field/text-field";
import { attempt } from "@/shared/web/attempt";
import { groupedDigits, moneyText, parseMoneyInput } from "@/shared/web/money-text";
import { orderPath } from "@/shared/web/routes";

import { lineAmount, OrderLineFields, wholeNumber, type LineState } from "./order-line-fields";

import styles from "./order-form.module.scss";

function emptyLine(): LineState {
  return {
    key: crypto.randomUUID(),
    productId: undefined,
    productName: "",
    quantity: "1",
    price: "",
  };
}

const describeCustomer = (customer: CustomerSuggestion) => ({
  key: customer.id,
  label: customer.name,
  detail: customer.area,
});

// The lines as the server takes them, or undefined when one is not complete. Empty lines are left out.
function parseLines(lines: ReadonlyArray<LineState>) {
  const filled = lines.filter((line) => line.productName.trim() !== "" || line.price.trim() !== "");
  const parsed = filled.map((line) => ({
    productId: line.productId,
    productName: line.productName,
    quantity: wholeNumber(line.quantity) ?? 0,
    unitPrice: parseMoneyInput(line.price),
  }));
  const complete = parsed.every(
    (line) => line.productName.trim() !== "" && line.quantity > 0 && line.unitPrice !== undefined,
  );

  return parsed.length > 0 && complete ? parsed : undefined;
}

// An order as fast to fill as a note allows: pick the customer by typing, then for each line a product (picked or
// new), how many and the price - filled in from the last time when known. The total follows as it is typed.
export function OrderForm({ view }: { readonly view: OrderFormView }) {
  const router = useRouter();
  const [customer, setCustomer] = useState(view.customer);
  const [customerText, setCustomerText] = useState(view.customer?.name ?? "");
  const [orderedOn, setOrderedOn] = useState(view.order?.orderedOn ?? view.today);
  const [note, setNote] = useState(view.order?.note ?? "");
  const [lines, setLines] = useState<ReadonlyArray<LineState>>(
    () =>
      view.order?.lines.map((line) => ({
        key: crypto.randomUUID(),
        productId: line.productId,
        productName: line.productName,
        quantity: String(line.quantity),
        price: groupedDigits(line.unitPrice),
      })) ?? [emptyLine()],
  );
  // The line added last, whose product field takes the focus
  const [addedKey, setAddedKey] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const total = lines.reduce((sum, line) => sum + lineAmount(line), 0);

  const changeLine = useCallback((key: string, change: Partial<LineState>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...change } : line)),
    );
    setError(undefined);
  }, []);
  const addLine = useCallback(() => {
    const line = emptyLine();
    setLines((current) => [...current, line]);
    setAddedKey(line.key);
  }, []);
  const removeLine = useCallback((key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  }, []);

  // Picking a suggestion also reports its name as typed, before or after the pick, so the choice is dropped only by
  // other words, judged against the current choice rather than this render's
  const typeCustomer = useCallback((text: string) => {
    setCustomerText(text);
    setCustomer((current) => (current?.name === text ? current : undefined));
    setError(undefined);
  }, []);
  const pickCustomer = useCallback((picked: CustomerSuggestion) => {
    setCustomer(picked);
    setCustomerText(picked.name);
  }, []);
  const suggestCustomers = useCallback((text: string) => findCustomers(text), []);
  const suggestProducts = useCallback(
    (text: string) => findProducts(text, customer?.id),
    [customer?.id],
  );
  const typeDay = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setOrderedOn(event.target.value),
    [],
  );
  const typeNote = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value),
    [],
  );

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (customer === undefined) {
        setError(ordersCopy.customerRequired);
        return;
      }
      const parsed = parseLines(lines);
      if (parsed === undefined) {
        setError(ordersCopy.linesIncomplete);
        return;
      }

      const input = { customerId: customer.id, orderedOn, note, lines: parsed };
      setPending(true);
      startTransition(async () => {
        const result = await attempt(() =>
          view.order === undefined
            ? placeOrder(input)
            : reviseOrder(view.order.id, view.order.version, input),
        );
        if (!result.ok) {
          setPending(false);
          setError(result.error);
          return;
        }

        router.push(orderPath(result.value));
      });
    },
    [customer, lines, note, orderedOn, router, view.order],
  );

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <SuggestField
        label={ordersCopy.customer}
        value={customerText}
        onValueChange={typeCustomer}
        suggest={suggestCustomers}
        describe={describeCustomer}
        onPick={pickCustomer}
        placeholder={ordersCopy.pickCustomer}
        emptyText={ordersCopy.customerUnknown}
        focusOnMount={view.customer === undefined}
      />
      <TextField
        label={ordersCopy.orderedOn}
        type="date"
        value={orderedOn}
        max={view.today}
        onChange={typeDay}
      />

      <fieldset className={styles.lines}>
        <legend className={styles.legend}>{ordersCopy.product}</legend>
        {lines.map((line, index) => (
          <OrderLineFields
            key={line.key}
            line={line}
            number={index + 1}
            removable={lines.length > 1}
            focusOnMount={line.key === addedKey}
            suggest={suggestProducts}
            onChange={changeLine}
            onRemove={removeLine}
          />
        ))}
        <Button variant="quiet" onClick={addLine}>
          <AddIcon aria-hidden />
          {ordersCopy.addLine}
        </Button>
      </fieldset>

      <label className={styles.noteLabel}>
        <span>{ordersCopy.note}</span>
        <TextArea value={note} onChange={typeNote} />
      </label>

      <p className={styles.total}>
        <span>{ordersCopy.total}</span>
        <output>{moneyText(total)}</output>
      </p>
      {error === undefined ? null : (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? actionLabels.saving : ordersCopy.save}
      </Button>
    </form>
  );
}
