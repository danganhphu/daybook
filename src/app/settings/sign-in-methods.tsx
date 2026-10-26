"use client";

import { useCallback, useMemo, useState, useTransition } from "react";

import { passkeyTerm } from "@/features/access/application/access-terms";
import { accessCopy } from "@/features/access/web/access-copy";
import type { AccountView, PasskeyRow } from "@/features/access/web/account-view";
import { problemMessage } from "@/features/access/web/attempt-setting";
import { useWebAuthnSupport } from "@/features/access/web/use-webauthn-support";
import { actionLabels, optionsFor } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { AddIcon, DeleteIcon } from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListAction } from "@/shared/ui/list/list-action";
import { ListRow } from "@/shared/ui/list/list-row";

import { beginAddingPasskey, removePasskey } from "./actions";
import { AddPasskeyDialog } from "./add-passkey-dialog";
import { PasswordRow } from "./password-row";
import { useOutcomeToast } from "./use-outcome-toast";
import type { StepUp } from "./use-step-up";
import { useWayInChanged } from "./use-way-in-changed";

export type SignInMethodsProps = {
  readonly view: AccountView;
  readonly hasOtherDevices: boolean;
  readonly run: StepUp["run"];
};

// Every way into this account: its passkeys, one per device or password manager, and the fallback password
export function SignInMethods({ view, hasOtherDevices, run }: SignInMethodsProps) {
  const supported = useWebAuthnSupport();
  const tell = useOutcomeToast();
  const announce = useWayInChanged(hasOtherDevices, run);
  const [adding, setAdding] = useState<PublicKeyCredentialCreationOptionsJSON>();
  // Kept after the dialog closes, so its title does not change while it fades out
  const [target, setTarget] = useState<PasskeyRow>();
  const [confirming, setConfirming] = useState(false);
  const [working, startWorking] = useTransition();

  // The first tap fetches the prompt (asking to confirm first when the sign-in is old); the dialog's tap uses it
  const startAdding = useCallback(() => {
    startWorking(async () => {
      const prompt = await run(() => beginAddingPasskey());
      if (prompt.ok) {
        setAdding(prompt.value);
        return;
      }
      tell(problemMessage(prompt.error));
    });
  }, [run, tell]);
  const stopAdding = useCallback(() => setAdding(undefined), []);

  const askToRemove = useCallback((passkey: PasskeyRow) => {
    setTarget(passkey);
    setConfirming(true);
  }, []);
  const stopRemoving = useCallback(() => setConfirming(false), []);
  const remove = useCallback(() => {
    setConfirming(false);
    if (target === undefined) {
      return;
    }
    startWorking(async () => {
      const removed = await run(() => removePasskey(target.id));
      if (removed.ok) {
        announce(`Đã xoá ${target.title}`);
        return;
      }
      tell(problemMessage(removed.error));
    });
  }, [target, run, tell, announce]);

  return (
    <>
      <List heading="Cách đăng nhập" footer={accessCopy.backupPasswordPurpose}>
        {view.passkeys.map((passkey) => (
          <PasskeyItem key={passkey.id} passkey={passkey} onRemove={askToRemove} />
        ))}
        {supported ? (
          <ListAction
            label={accessCopy.addPasskey}
            icon={AddIcon}
            disabled={working}
            onClick={startAdding}
          />
        ) : null}
        <PasswordRow
          password={view.password}
          username={view.username}
          run={run}
          onChanged={announce}
        />
      </List>
      <AddPasskeyDialog options={adding} run={run} onClose={stopAdding} />
      <ConfirmDialog
        open={confirming}
        title={`Xoá ${target?.title ?? passkeyTerm}?`}
        description="Sau khi xoá, không đăng nhập bằng nó được nữa."
        confirmLabel={actionLabels.remove}
        onConfirm={remove}
        onClose={stopRemoving}
      />
    </>
  );
}

function PasskeyItem({
  passkey,
  onRemove,
}: {
  readonly passkey: PasskeyRow;
  readonly onRemove: (passkey: PasskeyRow) => void;
}) {
  const destructive = useMemo<MenuAction>(
    () => ({ label: actionLabels.remove, icon: DeleteIcon, onSelect: () => onRemove(passkey) }),
    [passkey, onRemove],
  );

  return (
    <ListRow title={passkey.title} detail={passkey.detail}>
      <ActionMenu label={optionsFor(passkey.title)} destructive={destructive} />
    </ListRow>
  );
}
