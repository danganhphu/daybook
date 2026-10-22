"use client";

import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";

import { Dialog } from "./dialog";

export type ConfirmDialogProps = {
  readonly open: boolean;
  // A question: "Xoá ...?"
  readonly title: string;
  // What will be lost, so the answer is an informed one
  readonly description?: string | undefined;
  // The verb, never "OK": "Xoá"
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
};

// Only for what cannot be undone; anything that can be takes one tap and an Undo in the toast (docs/ui.md)
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <Button tone="danger" size="lg" onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button variant="quiet" size="lg" onClick={onClose}>
        {actionLabels.cancel}
      </Button>
    </Dialog>
  );
}
