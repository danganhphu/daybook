"use client";

import { startTransition, useCallback, useState, type ChangeEvent, type FormEvent } from "react";

import type { Result } from "@/shared/domain/result";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { Dialog } from "@/shared/ui/dialog/dialog";
import { TextField } from "@/shared/ui/text-field/text-field";
import { attempt } from "@/shared/web/attempt";

import styles from "./name-dialog.module.scss";

export type NameDialogProps<T> = {
  readonly title: string;
  readonly label: string;
  // What the field starts with: the current name, for a rename
  readonly initial?: string | undefined;
  readonly maxLength: number;
  // The server action; its refusal is shown under the field and the dialog stays open
  readonly save: (name: string) => Promise<Result<T, string>>;
  readonly onSaved: (saved: T) => void;
  readonly onClose: () => void;
};

// One name to type: a new product, a new name for one, another name a customer or product is known by. Mounted when
// it opens, so every opening starts from `initial`.
export function NameDialog<T>({
  title,
  label,
  initial,
  maxLength,
  save,
  onSaved,
  onClose,
}: NameDialogProps<T>) {
  const [text, setText] = useState(initial ?? "");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const type = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
    setError(undefined);
  }, []);

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setPending(true);
      startTransition(async () => {
        const result = await attempt(() => save(text));
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }

        onSaved(result.value);
        onClose();
      });
    },
    [onClose, onSaved, save, text],
  );

  return (
    <Dialog open onClose={onClose} title={title}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <TextField
          label={label}
          value={text}
          onChange={type}
          error={error}
          maxLength={maxLength}
          autoComplete="off"
          required
        />
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? actionLabels.saving : actionLabels.save}
        </Button>
        <Button size="lg" onClick={onClose}>
          {actionLabels.cancel}
        </Button>
      </form>
    </Dialog>
  );
}
