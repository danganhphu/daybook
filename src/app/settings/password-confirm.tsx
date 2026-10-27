"use client";

import { useCallback, useState, type FormEvent } from "react";

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

// A sign-in as itself, rate limited as signing in is. Plain state, not a form action, as in passkey-confirm.tsx.
export function PasswordConfirm({ username, onConfirmed }: PasswordConfirmProps) {
  const [status, setStatus] = useState<string>();
  const [pending, setPending] = useState(false);

  const check = useCallback(
    async (password: string) => {
      setPending(true);
      const signedIn = await signInWithPassword(username, password);
      if (signedIn.ok) {
        onConfirmed();
        return;
      }
      setStatus(signedIn.error);
      setPending(false);
    },
    [username, onConfirmed],
  );

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void check(formText(new FormData(event.currentTarget), accessFields.password));
    },
    [check],
  );

  return (
    <form className={styles.form} onSubmit={submit}>
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
