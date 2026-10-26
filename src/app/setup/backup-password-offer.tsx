"use client";

import { useActionState, useCallback } from "react";

import { saveBackupPassword } from "@/app/settings/save-backup-password";
import { accessCopy } from "@/features/access/web/access-copy";
import { accessFields } from "@/features/access/web/access-fields";
import { AccessForm } from "@/features/access/web/access-form";
import { AccessPanel } from "@/features/access/web/access-panel";
import { attemptSetting } from "@/features/access/web/attempt-setting";
import { enterApp } from "@/features/access/web/enter-app";
import { NewPasswordFields } from "@/features/access/web/new-password-fields";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { formText } from "@/shared/web/form-text";

type Draft = { readonly text: string; readonly error: string | undefined };

const empty: Draft = { text: "", error: undefined };

// The last step of an invite, and the only one that can be skipped. The session is a minute old, so no step-up.
export function BackupPasswordOffer({ username }: { readonly username: string }) {
  const save = useCallback(
    async (_: Draft, form: FormData): Promise<Draft> => {
      const text = formText(form, accessFields.password);
      const saved = await saveBackupPassword(text, username, attemptSetting);
      if (saved.ok) {
        enterApp();
        return empty;
      }

      return { text, error: saved.error };
    },
    [username],
  );
  const [draft, submit, pending] = useActionState(save, empty);

  return (
    <AccessPanel
      title={accessCopy.setBackupPassword}
      description={accessCopy.backupPasswordPurpose}
    >
      <AccessForm action={submit}>
        <NewPasswordFields username={username} defaultValue={draft.text} error={draft.error} />
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? actionLabels.saving : actionLabels.save}
        </Button>
        <Button variant="quiet" onClick={enterApp}>
          Để sau
        </Button>
      </AccessForm>
    </AccessPanel>
  );
}
