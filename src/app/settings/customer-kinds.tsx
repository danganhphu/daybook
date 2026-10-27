"use client";

import { startTransition, useActionState, useCallback, useMemo, useState } from "react";

import { kindNameMaxLength } from "@/features/customers/domain/customer-limits";
import type { KindResult } from "@/features/customers/web/commands";
import type { KindView } from "@/features/customers/web/customer-view";
import { customersCopy } from "@/features/customers/web/customers-copy";
import { actionLabels, optionsFor } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { AddIcon, EditIcon, VisibilityIcon, VisibilityOffIcon } from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListAction } from "@/shared/ui/list/list-action";
import { ListContent } from "@/shared/ui/list/list-content";
import { ListRow } from "@/shared/ui/list/list-row";
import { TextField } from "@/shared/ui/text-field/text-field";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import { formText } from "@/shared/web/form-text";

import { EditorButtons } from "./editor-buttons";
import { addKind, hideKind, renameKind, showKind } from "./kind-actions";

import styles from "./settings.module.scss";

const fieldName = "name";

// The kinds of customer the book knows, in the owner's own words: added, renamed and hidden here. Hidden ones stay on
// the customers who have them; they are only no longer offered.
export function CustomerKinds({ kinds }: { readonly kinds: ReadonlyArray<KindView> }) {
  // Which row is open for typing: a kind's id, "new", or none
  const [editing, setEditing] = useState<string>();
  const close = useCallback(() => setEditing(undefined), []);
  const openNew = useCallback(() => setEditing("new"), []);

  return (
    <List heading={customersCopy.kinds.title} footer={customersCopy.kinds.footer}>
      {kinds.map((kind) =>
        editing === kind.id ? (
          <NameEditor key={kind.id} kind={kind} onClose={close} />
        ) : (
          <KindRow key={kind.id} kind={kind} onRename={setEditing} />
        ),
      )}
      {editing === "new" ? (
        <NameEditor kind={undefined} onClose={close} />
      ) : (
        <ListAction label={customersCopy.kinds.add} icon={AddIcon} onClick={openNew} />
      )}
    </List>
  );
}

function KindRow({
  kind,
  onRename,
}: {
  readonly kind: KindView;
  readonly onRename: (id: string) => void;
}) {
  const toast = useToast();

  const toggle = useCallback(() => {
    startTransition(async () => {
      const result = await attempt(() =>
        kind.hidden ? showKind(kind.id, kind.version) : hideKind(kind.id, kind.version),
      );
      if (!result.ok) {
        toast.show({ title: result.error });
      }
    });
  }, [kind.hidden, kind.id, kind.version, toast]);

  const actions = useMemo<ReadonlyArray<MenuAction>>(
    () => [
      { label: actionLabels.edit, icon: EditIcon, onSelect: () => onRename(kind.id) },
      kind.hidden
        ? { label: customersCopy.show, icon: VisibilityIcon, onSelect: toggle }
        : { label: customersCopy.kinds.hide, icon: VisibilityOffIcon, onSelect: toggle },
    ],
    [kind.hidden, kind.id, onRename, toggle],
  );

  return (
    <ListRow title={kind.name} detail={kind.hidden ? customersCopy.kinds.hidden : undefined}>
      <ActionMenu label={optionsFor(kind.name)} actions={actions} />
    </ListRow>
  );
}

type Draft = { readonly text: string; readonly error: string | undefined };

// Renames `kind`, or adds a new one when there is none
function NameEditor({
  kind,
  onClose,
}: {
  readonly kind: KindView | undefined;
  readonly onClose: () => void;
}) {
  const [draft, submit, pending] = useActionState(
    async (_: Draft, form: FormData): Promise<Draft> => {
      const text = formText(form, fieldName);
      const result = await attempt((): Promise<KindResult> =>
        kind === undefined ? addKind(text) : renameKind(kind.id, kind.version, text),
      );
      if (!result.ok) {
        return { text, error: result.error };
      }

      onClose();
      return { text, error: undefined };
    },
    { text: kind?.name ?? "", error: undefined },
  );

  return (
    <ListContent>
      <form className={styles.form} action={submit}>
        <TextField
          label={customersCopy.kinds.name}
          name={fieldName}
          defaultValue={draft.text}
          error={draft.error}
          maxLength={kindNameMaxLength}
          autoComplete="off"
          required
        />
        <EditorButtons pending={pending} onCancel={onClose} />
      </form>
    </ListContent>
  );
}
