"use client";

import { useActionState } from "react";

import { signInWithPassword } from "@/app/sign-in/sign-in-with-password";
import { accessCopy } from "@/features/access/web/access-copy";
import { accessFields } from "@/features/access/web/access-fields";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { Status } from "@/shared/ui/status/status";
import { TextField } from "@/shared/ui/text-field/text-field";
import { formText } from "@/shared/web/form-text";

import styles from "./settings.module.scss";

export type PasswordConfirmProps = {
  readonly username: string;
  readonly onConfirmed: () => void;
};

// Confirming with the password, for an account that has no passkey: a sign-in as itself, which replaces the session
// with a fresh one. Rate limited and locked exactly as signing in is.
export function PasswordConfirm({ username, onConfirmed }: PasswordConfirmProps) {
  const [status, action, pending] = useActionState(
    async (_: string | undefined, form: FormData): Promise<string | undefined> => {
      const signedIn = await signInWithPassword(username, formText(form, accessFields.password));
      if (signedIn.ok) {
        onConfirmed();
        return undefined;
      }

      return signedIn.error;
    },
    undefined,
  );

  return (
    <form className={styles.form} action={action}>
      {/* For the password manager: it fills the password it saved for this username */}
      <input
        hidden
        name={accessFields.username}
        autoComplete="username"
        value={username}
        readOnly
      />
      <TextField
        label={accessCopy.password}
        name={accessFields.password}
        type="password"
        autoComplete="current-password"
        required
      />
      <Status message={status} tone="danger" />
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {actionLabels.confirm}
      </Button>
    </form>
  );
}
