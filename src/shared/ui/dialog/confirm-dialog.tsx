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
  readonly tone?: "danger" | "neutral" | undefined;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
};

// Before every delete, as the apps people use do; one that can be undone keeps its Undo in the toast too
// (docs/ui/design-system.md). `useConfirm` asks with it from wherever the delete is.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "danger",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <Button tone={tone} size="lg" onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button variant="quiet" size="lg" onClick={onClose}>
        {actionLabels.cancel}
      </Button>
    </Dialog>
  );
}
