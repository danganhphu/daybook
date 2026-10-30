"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

import { ConfirmDialog } from "./confirm-dialog";

export type ConfirmRequest = {
  // A question: "Xoá đơn này?"
  readonly title: string;
  // What goes, and whether it can come back
  readonly description?: string | undefined;
  // The verb: "Xoá"
  readonly confirmLabel: string;
  // Neutral when the answer offered is not a delete, such as hiding what cannot be deleted
  readonly tone?: "danger" | "neutral" | undefined;
};

export type Confirm = {
  // Resolves true once the person confirms, false if they cancel or close it
  readonly confirm: (request: ConfirmRequest) => Promise<boolean>;
  // Rendered once by the screen that asks
  readonly dialog: ReactNode;
};

// Asks before a delete, as a question awaited where the delete is: `if (!(await confirm({...}))) return;`
export function useConfirm(): Confirm {
  const [open, setOpen] = useState(false);
  // Kept after closing, so the words stay while the dialog animates away
  const [request, setRequest] = useState<ConfirmRequest>();
  const answer = useRef<(yes: boolean) => void>(undefined);

  const confirm = useCallback(
    (asked: ConfirmRequest) =>
      new Promise<boolean>((resolve) => {
        answer.current?.(false);
        answer.current = resolve;
        setRequest(asked);
        setOpen(true);
      }),
    [],
  );
  const settle = useCallback((yes: boolean) => {
    answer.current?.(yes);
    answer.current = undefined;
    setOpen(false);
  }, []);
  const accept = useCallback(() => settle(true), [settle]);
  const cancel = useCallback(() => settle(false), [settle]);

  return {
    confirm,
    dialog: (
      <ConfirmDialog
        open={open}
        title={request?.title ?? ""}
        description={request?.description}
        confirmLabel={request?.confirmLabel ?? ""}
        tone={request?.tone}
        onConfirm={accept}
        onClose={cancel}
      />
    ),
  };
}
