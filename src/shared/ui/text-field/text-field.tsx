"use client";

import { Field } from "@base-ui/react/field";
import { Eye, EyeOff } from "lucide-react";
import { useCallback, useState, type ComponentProps } from "react";

import { IconButton } from "@/shared/ui/button/icon-button";

import styles from "./text-field.module.scss";

export type TextFieldProps = Omit<
  ComponentProps<"input">,
  "className" | "style" | "type" | "children"
> & {
  readonly label: string;
  readonly type?: "text" | "password";
  // A hint under the field, such as what a valid value looks like; read out with the field
  readonly description?: string | undefined;
  // Shown under the field and tied to it for screen readers; the field is marked invalid while there is one
  readonly error?: string | undefined;
};

// One labelled line. A password field shows its text on request instead of asking for it twice (NIST 800-63B-4,
// 3.1.1.2: offer to show the password; no confirmation field).
export function TextField({ label, type = "text", description, error, ...props }: TextFieldProps) {
  const [shown, setShown] = useState(false);
  const toggle = useCallback(() => setShown((value) => !value), []);
  const password = type === "password";

  return (
    <Field.Root className={styles.field} invalid={error !== undefined}>
      <Field.Label className={styles.label}>{label}</Field.Label>
      <div className={styles.box}>
        <Field.Control
          {...props}
          className={styles.input}
          type={password && !shown ? "password" : "text"}
        />
        {password ? (
          <IconButton
            icon={shown ? EyeOff : Eye}
            label={shown ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            aria-pressed={shown}
            onClick={toggle}
          />
        ) : null}
      </div>
      {description === undefined ? null : (
        <Field.Description className={styles.description}>{description}</Field.Description>
      )}
      <Field.Error className={styles.error} match={error !== undefined}>
        {error}
      </Field.Error>
    </Field.Root>
  );
}
