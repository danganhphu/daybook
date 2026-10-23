"use client";

import { startTransition, useCallback, useRef, useState, type FormEvent } from "react";

import { takePayment } from "@/app/(app)/orders/actions";
import { ordersCopy } from "@/features/orders/web/orders-copy";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { Dialog } from "@/shared/ui/dialog/dialog";
import { SelectField } from "@/shared/ui/select-field/select-field";
import { TextField } from "@/shared/ui/text-field/text-field";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import { formText } from "@/shared/web/form-text";
import { groupedDigits, moneyText, parseMoneyInput } from "@/shared/web/money-text";

import styles from "./order-screen.module.scss";

export type PaymentDialogProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly orderId: string;
  readonly version: number;
  // Filled in, since most payments settle the order
  readonly owed: number;
  readonly today: string;
};

const methods = [
  { value: "cash", label: ordersCopy.cash },
  { value: "transfer", label: ordersCopy.transfer },
];

// What came in, when, and how. The amount starts at what is owed; the server refuses more than that.
export function PaymentDialog({
  open,
  onClose,
  orderId,
  version,
  owed,
  today,
}: PaymentDialogProps) {
  const toast = useToast();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  // A refused amount takes the focus back, so its error is read out with it
  const amountField = useRef<HTMLInputElement>(null);

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const amount = parseMoneyInput(formText(form, "amount"));
      if (amount === undefined || amount === 0) {
        setError(ordersCopy.amountInvalid);
        amountField.current?.focus();
        return;
      }

      setPending(true);
      startTransition(async () => {
        const result = await attempt(() =>
          takePayment(orderId, version, {
            amount,
            paidOn: formText(form, "paidOn"),
            method: formText(form, "method"),
            note: formText(form, "note"),
          }),
        );
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          amountField.current?.focus();
          return;
        }

        setError(undefined);
        onClose();
        toast.show({ title: `${ordersCopy.took} ${moneyText(amount)}` });
      });
    },
    [onClose, orderId, toast, version],
  );

  return (
    <Dialog open={open} onClose={onClose} title={ordersCopy.takePayment}>
      <form className={styles.dialogForm} onSubmit={submit} noValidate>
        <TextField
          ref={amountField}
          label={`${ordersCopy.amount} (đ)`}
          name="amount"
          inputMode="numeric"
          defaultValue={groupedDigits(owed)}
          autoComplete="off"
          error={error}
        />
        <TextField
          label={ordersCopy.paidOn}
          name="paidOn"
          type="date"
          defaultValue={today}
          max={today}
        />
        <SelectField
          label={ordersCopy.method}
          name="method"
          options={methods}
          emptyLabel={ordersCopy.noMethod}
          defaultValue=""
        />
        <TextField label={ordersCopy.note} name="note" autoComplete="off" />
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? actionLabels.saving : ordersCopy.takePayment}
        </Button>
        <Button size="lg" onClick={onClose}>
          {actionLabels.cancel}
        </Button>
      </form>
    </Dialog>
  );
}
