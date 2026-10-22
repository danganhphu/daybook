"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useCallback, type ReactNode } from "react";

import styles from "./dialog.module.scss";

export type DialogProps = {
  readonly open: boolean;
  // Escape, a tap outside, or a button inside that cancels
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string | undefined;
  // The buttons; one of them should close the dialog
  readonly children: ReactNode;
};

// A question that needs an answer before going on. A sheet at the bottom on a phone, where the thumb is; a card in
// the middle on a desk. Focus stays inside until it closes (Base UI's modal dialog).
export function Dialog({ open, onClose, title, description, children }: DialogProps) {
  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={styles.backdrop} />
        <BaseDialog.Popup className={styles.popup}>
          <BaseDialog.Title className={styles.title}>{title}</BaseDialog.Title>
          {description === undefined ? null : (
            <BaseDialog.Description className={styles.description}>
              {description}
            </BaseDialog.Description>
          )}
          <div className={styles.actions}>{children}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
