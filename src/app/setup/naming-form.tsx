"use client";

import { useCallback } from "react";

import { usernameRule } from "@/features/access/domain/account-limits";
import type { NamingProblem } from "@/features/access/web/access-commands";
import { accessCopy } from "@/features/access/web/access-copy";
import { accessFields } from "@/features/access/web/access-fields";
import { AccessForm } from "@/features/access/web/access-form";
import { AccessPanel } from "@/features/access/web/access-panel";
import { Button } from "@/shared/ui/button/button";
import { TextField } from "@/shared/ui/text-field/text-field";
import { formText } from "@/shared/web/form-text";

export type Naming = { readonly displayName: string; readonly username: string };

export type NamingFormProps = {
  // What was typed before a refusal; React resets the form after every submit
  readonly typed: Naming;
  readonly problem: NamingProblem | undefined;
  readonly pending: boolean;
  readonly onName: (naming: Naming) => void;
};

// The first step of an invite: the newcomer says who they are, and the account is made for that
export function NamingForm({ typed, problem, pending, onName }: NamingFormProps) {
  const submit = useCallback(
    (form: FormData) =>
      onName({
        displayName: formText(form, accessFields.displayName),
        username: formText(form, accessFields.username),
      }),
    [onName],
  );

  return (
    <AccessPanel title="Tạo tài khoản" status={problem?.form}>
      <AccessForm action={submit}>
        <TextField
          label={accessCopy.displayName}
          name={accessFields.displayName}
          defaultValue={typed.displayName}
          error={problem?.displayName}
          autoComplete="name"
          required
        />
        <TextField
          label={accessCopy.username}
          name={accessFields.username}
          defaultValue={typed.username}
          description={usernameRule}
          error={problem?.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          Tiếp tục
        </Button>
      </AccessForm>
    </AccessPanel>
  );
}
