"use client";

import {
  startTransition,
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { findCustomers } from "@/app/(app)/orders/actions";
import { addReminder, reviseReminder } from "@/app/(app)/reminders/actions";
import { describeCustomer, type CustomerSuggestion } from "@/features/orders/web/order-view";
import type { ReminderView } from "@/features/reminders/web/reminder-view";
import { remindersCopy } from "@/features/reminders/web/reminders-copy";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { Dialog } from "@/shared/ui/dialog/dialog";
import { SuggestField } from "@/shared/ui/suggest-field/suggest-field";
import { TextArea } from "@/shared/ui/text-area/text-area";
import { TextField } from "@/shared/ui/text-field/text-field";
import { attempt } from "@/shared/web/attempt";
import { nextDay } from "@/shared/web/next-day";

import styles from "./reminder-dialog.module.scss";

type Customer = { readonly id: string; readonly name: string };

export type ReminderDialogProps = {
  readonly onClose: () => void;
  readonly today: string;
  // The one being edited; otherwise a new one
  readonly reminder?: ReminderView | undefined;
  // A new one made from a note: its words to start from
  readonly fromNote?: { readonly id: string; readonly text: string } | undefined;
  // Set and not changeable, on a customer's page
  readonly customer?: Customer | undefined;
};

const suggestCustomers = (text: string) => findCustomers(text);

// Mounted when it opens, so every opening starts from what it was opened with
export function ReminderDialog({
  onClose,
  today,
  reminder,
  fromNote,
  customer: fixedCustomer,
}: ReminderDialogProps) {
  const [text, setText] = useState(reminder?.text ?? fromNote?.text ?? "");
  const [dueOn, setDueOn] = useState(reminder?.dueOn ?? today);
  const [customer, setCustomer] = useState(fixedCustomer ?? reminder?.customer);
  const [customerText, setCustomerText] = useState(customer?.name ?? "");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const textBox = useRef<HTMLTextAreaElement>(null);
  const errorId = useId();
  const tomorrow = nextDay(today);

  const typeText = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    setError(undefined);
  }, []);
  const pickDay = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDueOn(event.target.value);
  }, []);
  const dueToday = useCallback(() => setDueOn(today), [today]);
  const dueTomorrow = useCallback(() => setDueOn(tomorrow), [tomorrow]);
  // As on the order form: a pick also reports its name as typed, in either order
  const typeCustomer = useCallback((typed: string) => {
    setCustomerText(typed);
    setCustomer((current) => (current?.name === typed ? current : undefined));
  }, []);
  const pickCustomer = useCallback((picked: CustomerSuggestion) => {
    setCustomer({ id: picked.id, name: picked.name });
    setCustomerText(picked.name);
  }, []);

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (customer === undefined && customerText.trim() !== "") {
        setError(remindersCopy.customerUnknown);
        return;
      }

      const input = {
        text,
        dueOn,
        customerId: customer?.id ?? "",
        ...(fromNote === undefined ? {} : { noteId: fromNote.id }),
      };
      setPending(true);
      startTransition(async () => {
        const result =
          reminder === undefined
            ? await attempt(() => addReminder(input))
            : await attempt(() => reviseReminder(reminder.id, reminder.version, input));
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          textBox.current?.focus();
          return;
        }

        onClose();
      });
    },
    [customer, customerText, dueOn, fromNote, onClose, reminder, text],
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title={reminder === undefined ? remindersCopy.add : remindersCopy.edit}
    >
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.field}>
          <span className={styles.label}>{remindersCopy.text}</span>
          <TextArea
            ref={textBox}
            value={text}
            onChange={typeText}
            aria-invalid={error !== undefined}
            aria-describedby={error === undefined ? undefined : errorId}
          />
        </label>
        {error === undefined ? null : (
          <p id={errorId} role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className={styles.days}>
          <TextField label={remindersCopy.dueOn} type="date" value={dueOn} onChange={pickDay} />
          <div className={styles.quickDays}>
            <Button onClick={dueToday} aria-pressed={dueOn === today}>
              {remindersCopy.today}
            </Button>
            <Button onClick={dueTomorrow} aria-pressed={dueOn === tomorrow}>
              {remindersCopy.tomorrow}
            </Button>
          </div>
        </div>
        {fixedCustomer === undefined ? (
          <SuggestField
            label={remindersCopy.customer}
            value={customerText}
            onValueChange={typeCustomer}
            suggest={suggestCustomers}
            describe={describeCustomer}
            onPick={pickCustomer}
            placeholder={remindersCopy.customerOptional}
          />
        ) : (
          <p className={styles.customer}>
            {remindersCopy.customer}: {fixedCustomer.name}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? actionLabels.saving : actionLabels.save}
        </Button>
        <Button size="lg" onClick={onClose}>
          {actionLabels.cancel}
        </Button>
      </form>
    </Dialog>
  );
}
