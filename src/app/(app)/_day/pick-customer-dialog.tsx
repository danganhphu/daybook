"use client";

import { useCallback, useState } from "react";

import { findCustomers } from "@/app/(app)/orders/actions";
import { describeCustomer, type CustomerSuggestion } from "@/features/orders/web/order-view";
import { readingCopy } from "@/features/reading/web/reading-copy";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { Dialog } from "@/shared/ui/dialog/dialog";
import { SuggestField } from "@/shared/ui/suggest-field/suggest-field";

import styles from "./pick-customer-dialog.module.scss";

export type PickCustomerDialogProps = {
  // The note's words, to recall which order this is
  readonly about: string;
  readonly onPick: (customerId: string) => void;
  readonly onClose: () => void;
};

// Whose order a message is, when it calls the customer by a name the list does not hold. A pick answers at once.
export function PickCustomerDialog({ about, onPick, onClose }: PickCustomerDialogProps) {
  const [text, setText] = useState("");
  const pick = useCallback(
    (picked: CustomerSuggestion) => {
      onPick(picked.id);
      onClose();
    },
    [onPick, onClose],
  );

  return (
    <Dialog open onClose={onClose} title={readingCopy.pickTitle} description={about}>
      <div className={styles.form}>
        <SuggestField
          label={readingCopy.customer}
          value={text}
          onValueChange={setText}
          suggest={findCustomers}
          describe={describeCustomer}
          onPick={pick}
          emptyText={readingCopy.noCustomer}
          focusOnMount
        />
        <Button size="lg" onClick={onClose}>
          {actionLabels.cancel}
        </Button>
      </div>
    </Dialog>
  );
}
