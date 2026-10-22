"use client";

import { useActionState, useEffect, useRef, type KeyboardEvent } from "react";

import { backupPasswordTerm } from "@/features/access/application/access-terms";
import { accessFields } from "@/features/access/web/access-fields";
import type { PasswordRow as PasswordView } from "@/features/access/web/account-view";
import { NewPasswordFields } from "@/features/access/web/new-password-fields";
import { Button } from "@/shared/ui/button/button";
import { ListContent } from "@/shared/ui/list/list-content";
import { ListRow } from "@/shared/ui/list/list-row";
import { useToast } from "@/shared/ui/toast/use-toast";
import { formText } from "@/shared/web/form-text";
import { sentenceCase } from "@/shared/web/sentence-case";

import { EditorButtons } from "./editor-buttons";
import { saveBackupPassword } from "./save-backup-password";
import { useInlineEdit } from "./use-inline-edit";
import type { StepUp } from "./use-step-up";

import styles from "./settings.module.scss";

const title = sentenceCase(backupPasswordTerm);

export type PasswordRowProps = {
  readonly password: PasswordView;
  readonly username: string;
  readonly run: StepUp["run"];
};

// The fallback password: set when there is none, changed when there is, and set anew when it is locked
export function PasswordRow({ password, username, run }: PasswordRowProps) {
  const { editing, open, close, opener, cancelOnEscape } = useInlineEdit();
  const isSet = password.kind === "set";

  if (editing) {
    return (
      <PasswordEditor
        username={username}
        isSet={isSet}
        run={run}
        onClose={close}
        onKeyDown={cancelOnEscape}
      />
    );
  }

  return (
    <ListRow title={title} detail={isSet ? password.detail : "Chưa đặt"}>
      <Button ref={opener} variant="quiet" onClick={open}>
        {isSet ? "Đổi" : "Đặt"}
      </Button>
    </ListRow>
  );
}

type Draft = { readonly text: string; readonly error: string | undefined };

type PasswordEditorProps = {
  readonly username: string;
  readonly isSet: boolean;
  readonly run: StepUp["run"];
  readonly onClose: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

function PasswordEditor({ username, isSet, run, onClose, onKeyDown }: PasswordEditorProps) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [draft, submit, pending] = useActionState(
    async (_: Draft, form: FormData): Promise<Draft> => {
      const text = formText(form, accessFields.password);
      const saved = await saveBackupPassword(text, run);
      if (!saved.ok) {
        return { text, error: saved.error };
      }

      toast.show({ title: `${isSet ? "Đã đổi" : "Đã đặt"} ${backupPasswordTerm}` });
      onClose();
      return { text: "", error: undefined };
    },
    { text: "", error: undefined },
  );

  useEffect(() => {
    input.current?.focus();
  }, []);

  return (
    <ListContent>
      <form className={styles.form} action={submit}>
        <NewPasswordFields
          username={username}
          defaultValue={draft.text}
          error={draft.error}
          inputRef={input}
          onKeyDown={onKeyDown}
        />
        <EditorButtons pending={pending} onCancel={onClose} />
      </form>
    </ListContent>
  );
}
