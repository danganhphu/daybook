"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useCallback, useTransition } from "react";

import { passkeyTerm } from "@/features/access/application/access-terms";
import { accessCopy } from "@/features/access/web/access-copy";
import { problemMessage } from "@/features/access/web/attempt-setting";
import { forBrowserCreation } from "@/features/access/web/browser-options";
import { promptErrorMessage } from "@/features/access/web/prompt-errors";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { Dialog } from "@/shared/ui/dialog/dialog";

import { finishAddingPasskey } from "./actions";
import { useOutcomeToast } from "./use-outcome-toast";
import type { StepUp } from "./use-step-up";

export type AddPasskeyDialogProps = {
  // The prompt the server handed out; the dialog is open while there is one
  readonly options: PublicKeyCredentialCreationOptionsJSON | undefined;
  readonly run: StepUp["run"];
  readonly onClose: () => void;
};

// The second tap of adding a passkey. The prompt is already here, so this tap goes straight to Face ID or the
// fingerprint: Safari refuses a prompt that does not come from a tap.
export function AddPasskeyDialog({ options, run, onClose }: AddPasskeyDialogProps) {
  const tell = useOutcomeToast();
  const [pending, startAdding] = useTransition();

  const add = useCallback(() => {
    if (options === undefined) {
      return;
    }
    startAdding(async () => {
      let message: string | undefined;
      try {
        // Before any other await, so Safari still counts it as the tap's own gesture
        const response = await startRegistration({ optionsJSON: forBrowserCreation(options) });
        const added = await run(() => finishAddingPasskey(response));
        message = added.ok ? `Đã thêm ${passkeyTerm}` : problemMessage(added.error);
      } catch (error) {
        message = promptErrorMessage(error, "add");
      }
      // The prompt is spent either way; another try starts from the list
      onClose();
      tell(message);
    });
  }, [options, run, onClose, tell]);

  return (
    <Dialog
      open={options !== undefined}
      onClose={onClose}
      title={accessCopy.addPasskey}
      description={`Bấm ${actionLabels.add} rồi làm theo hướng dẫn trên máy.`}
    >
      <Button variant="primary" size="lg" disabled={pending} onClick={add}>
        {actionLabels.add}
      </Button>
      <Button variant="quiet" onClick={onClose}>
        {actionLabels.cancel}
      </Button>
    </Dialog>
  );
}
