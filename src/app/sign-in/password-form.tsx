"use client";

import { useActionState } from "react";

import { accessCopy } from "@/features/access/web/access-copy";
import { accessFields } from "@/features/access/web/access-fields";
import { AccessForm } from "@/features/access/web/access-form";
import { enterApp } from "@/features/access/web/enter-app";
import { Button } from "@/shared/ui/button/button";
import { Status } from "@/shared/ui/status/status";
import { TextField } from "@/shared/ui/text-field/text-field";
import { formText } from "@/shared/web/form-text";

import { signInWithPassword } from "./sign-in-with-password";

type FormState = {
  // Kept after a failed try, so only the password has to be typed again
  readonly username: string;
  readonly status: string | undefined;
};

const empty: FormState = { username: "", status: undefined };

async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const username = formText(form, accessFields.username);
  const signedIn = await signInWithPassword(username, formText(form, accessFields.password));
  if (signedIn.ok) {
    enterApp();
  }

  return { username, status: signedIn.ok ? undefined : signedIn.error };
}

// The fallback: a username and the password. React resets the form after each try; the username comes back from
// the state, the password does not.
export function PasswordForm() {
  const [state, action, pending] = useActionState(signIn, empty);

  return (
    <AccessForm action={action}>
      <TextField
        label={accessCopy.username}
        name={accessFields.username}
        defaultValue={state.username}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
      />
      <TextField
        label={accessCopy.password}
        name={accessFields.password}
        type="password"
        autoComplete="current-password"
        required
      />
      <Status message={state.status} tone="danger" />
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Đang đăng nhập..." : accessCopy.signIn}
      </Button>
    </AccessForm>
  );
}
