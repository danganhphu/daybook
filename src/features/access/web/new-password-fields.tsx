import type { KeyboardEventHandler, Ref } from "react";

import { TextField } from "@/shared/ui/text-field/text-field";

import { accessFields } from "./access-fields";
import { passwordMessages } from "./browser-password";

export type NewPasswordFieldsProps = {
  // Whose password it is, for the password manager to save it under
  readonly username: string;
  // What was typed before a refused save; React resets the form after every submit
  readonly defaultValue: string;
  readonly error: string | undefined;
  readonly inputRef?: Ref<HTMLInputElement>;
  readonly onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
};

// A new fallback password, as one field: no "type it again" (NIST 800-63B-4 offers a show button instead), and a
// username beside it, hidden, so the password manager saves the pair (Chrome's guidance for change-password forms)
export function NewPasswordFields({
  username,
  defaultValue,
  error,
  inputRef,
  onKeyDown,
}: NewPasswordFieldsProps) {
  return (
    <>
      <input
        hidden
        name={accessFields.username}
        autoComplete="username"
        value={username}
        readOnly
      />
      <TextField
        ref={inputRef}
        label="Mật khẩu mới"
        name={accessFields.password}
        type="password"
        autoComplete="new-password"
        defaultValue={defaultValue}
        description={passwordMessages.hint}
        error={error}
        onKeyDown={onKeyDown}
        required
      />
    </>
  );
}
