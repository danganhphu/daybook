"use client";

import { useActionState, useEffect, useRef, type KeyboardEvent } from "react";

import { problemMessage } from "@/features/access/web/attempt-setting";
import type { SettingsResult } from "@/features/access/web/settings-commands";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { ListContent } from "@/shared/ui/list/list-content";
import { ListRow } from "@/shared/ui/list/list-row";
import { TextField, type TextFieldProps } from "@/shared/ui/text-field/text-field";
import { useToast } from "@/shared/ui/toast/use-toast";
import { formText } from "@/shared/web/form-text";

import { EditorButtons } from "./editor-buttons";
import { useInlineEdit } from "./use-inline-edit";

import styles from "./settings.module.scss";

const fieldName = "value";

export type EditableRowProps = {
  // What the value is, e.g. "Tên"; the row shows the value large and this beneath, as the phone's settings do
  readonly label: string;
  readonly value: string;
  readonly description?: string;
  readonly field?: Pick<TextFieldProps, "autoComplete" | "autoCapitalize" | "spellCheck">;
  // The server action; step-up, when it needs one, is already wrapped around it
  readonly save: (value: string) => Promise<SettingsResult<null>>;
  // The toast once saved, e.g. "Đã đổi tên"
  readonly saved: string;
};

// A value changed where it is shown: the row opens into a field, and closes again once saved or cancelled
export function EditableRow(props: EditableRowProps) {
  const { editing, open, close, opener, cancelOnEscape } = useInlineEdit();

  if (editing) {
    return <ValueEditor {...props} onClose={close} onKeyDown={cancelOnEscape} />;
  }

  return (
    <ListRow title={props.value} detail={props.label}>
      <Button
        ref={opener}
        variant="quiet"
        aria-label={`${actionLabels.edit} ${props.label.toLocaleLowerCase("vi")}`}
        onClick={open}
      >
        {actionLabels.edit}
      </Button>
    </ListRow>
  );
}

type Draft = {
  // What was typed, kept when a save is refused; React resets the form after every submit
  readonly text: string;
  readonly error: string | undefined;
};

type ValueEditorProps = EditableRowProps & {
  readonly onClose: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

function ValueEditor({
  label,
  value,
  description,
  field,
  save,
  saved,
  onClose,
  onKeyDown,
}: ValueEditorProps) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [draft, submit, pending] = useActionState(
    async (_: Draft, form: FormData): Promise<Draft> => {
      const text = formText(form, fieldName);
      const result = await save(text);
      if (!result.ok) {
        return { text, error: problemMessage(result.error) };
      }

      toast.show({ title: saved });
      onClose();
      return { text, error: undefined };
    },
    { text: value, error: undefined },
  );

  // Open with the cursor at the end, ready to carry on typing
  useEffect(() => {
    const box = input.current;
    if (box !== null) {
      box.focus();
      box.setSelectionRange(box.value.length, box.value.length);
    }
  }, []);

  return (
    <ListContent>
      <form className={styles.form} action={submit}>
        <TextField
          {...field}
          ref={input}
          label={label}
          name={fieldName}
          defaultValue={draft.text}
          description={description}
          error={draft.error}
          onKeyDown={onKeyDown}
          required
        />
        <EditorButtons pending={pending} onCancel={onClose} />
      </form>
    </ListContent>
  );
}
