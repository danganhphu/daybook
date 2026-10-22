"use client";

import { useCallback } from "react";

import { passkeyTerm } from "@/features/access/application/access-terms";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { Dialog } from "@/shared/ui/dialog/dialog";

import { PasskeyConfirm } from "./passkey-confirm";
import { PasswordConfirm } from "./password-confirm";

export type StepUpAccount = { readonly username: string; readonly hasPasskey: boolean };

export type StepUpDialogProps = {
  readonly open: boolean;
  // A new number for each time it is asked, so the last attempt's message and prompt are not carried over
  readonly round: number;
  readonly account: StepUpAccount;
  readonly onAnswer: (confirmed: boolean) => void;
};

// Asked before a security setting when the sign-in is older than the step-up window (ADR 0009, decision 5). With a
// passkey when the account has one, else with the password.
export function StepUpDialog({ open, round, account, onAnswer }: StepUpDialogProps) {
  const confirmed = useCallback(() => onAnswer(true), [onAnswer]);
  const cancel = useCallback(() => onAnswer(false), [onAnswer]);

  return (
    <Dialog
      open={open}
      onClose={cancel}
      title="Xác nhận lại"
      description={
        account.hasPasskey ? `Dùng ${passkeyTerm} để tiếp tục.` : "Nhập mật khẩu để tiếp tục."
      }
    >
      {account.hasPasskey ? (
        <PasskeyConfirm key={round} onConfirmed={confirmed} />
      ) : (
        <PasswordConfirm key={round} username={account.username} onConfirmed={confirmed} />
      )}
      <Button variant="quiet" onClick={cancel}>
        {actionLabels.cancel}
      </Button>
    </Dialog>
  );
}
