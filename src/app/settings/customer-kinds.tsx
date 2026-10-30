"use client";

import { startTransition, useActionState, useCallback, useMemo, useState } from "react";

import { undoDelete } from "@/app/(app)/deleted/undo-delete";
import { kindNameMaxLength } from "@/features/customers/domain/customer-limits";
import type { KindResult } from "@/features/customers/web/commands";
import type { KindView } from "@/features/customers/web/customer-view";
import { customersCopy } from "@/features/customers/web/customers-copy";
import { actionLabels, optionsFor } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { useConfirm, type Confirm } from "@/shared/ui/dialog/use-confirm";
import {
  AddIcon,
  DeleteIcon,
  EditIcon,
  VisibilityIcon,
  VisibilityOffIcon,
} from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListAction } from "@/shared/ui/list/list-action";
import { ListContent } from "@/shared/ui/list/list-content";
import { ListRow } from "@/shared/ui/list/list-row";
import { TextField } from "@/shared/ui/text-field/text-field";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import { formText } from "@/shared/web/form-text";
import { deleteQuestion, recentlyDeletedCopy } from "@/shared/web/recently-deleted";

import { EditorButtons } from "./editor-buttons";
import { addKind, deleteKind, hideKind, renameKind, showKind } from "./kind-actions";

import styles from "./settings.module.scss";

const fieldName = "name";

// The kinds of customer the book knows, in the owner's own words: added, renamed and hidden here. Hidden ones stay on
// the customers who have them; they are only no longer offered.
export function CustomerKinds({ kinds }: { readonly kinds: ReadonlyArray<KindView> }) {
  // Which row is open for typing: a kind's id, "new", or none
  const [editing, setEditing] = useState<string>();
  const close = useCallback(() => setEditing(undefined), []);
  const openNew = useCallback(() => setEditing("new"), []);
  const { confirm, dialog } = useConfirm();

  return (
    <>
      <List footer={customersCopy.kinds.footer}>
        {kinds.map((kind) =>
          editing === kind.id ? (
            <NameEditor key={kind.id} kind={kind} onClose={close} />
          ) : (
            <KindRow key={kind.id} kind={kind} onRename={setEditing} confirm={confirm} />
          ),
        )}
        {editing === "new" ? (
          <NameEditor kind={undefined} onClose={close} />
        ) : (
          <ListAction label={customersCopy.kinds.add} icon={AddIcon} onClick={openNew} />
        )}
      </List>
      {dialog}
    </>
  );
}

function KindRow({
  kind,
  onRename,
  confirm,
}: {
  readonly kind: KindView;
  readonly onRename: (id: string) => void;
  readonly confirm: Confirm["confirm"];
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

  // Asked first; its customers read as having none until it comes back, so the question says so. Undo in the toast.
  const remove = useCallback(() => {
    void (async () => {
      const sure = await confirm({
        title: deleteQuestion(customersCopy.kinds.one),
        description: `${customersCopy.kinds.removeMeans} ${recentlyDeletedCopy.canRestore}`,
        confirmLabel: actionLabels.remove,
      });
      if (!sure) {
        return;
      }
      startTransition(async () => {
        const result = await attempt(() => deleteKind(kind.id, kind.version));
        if (!result.ok) {
          toast.show({ title: result.error });
          return;
        }
        const { version } = result.value;
        toast.show({
          title: customersCopy.kinds.deleted,
          action: {
            label: actionLabels.undo,
            onAction: () => {
              startTransition(async () => {
                toast.show(await undoDelete({ kind: "kind", id: kind.id, version }));
              });
            },
          },
        });
      });
    })();
  }, [confirm, kind.id, kind.version, toast]);

  const actions = useMemo<ReadonlyArray<MenuAction>>(
    () => [
      { label: actionLabels.edit, icon: EditIcon, onSelect: () => onRename(kind.id) },
      kind.hidden
        ? { label: customersCopy.show, icon: VisibilityIcon, onSelect: toggle }
        : { label: customersCopy.kinds.hide, icon: VisibilityOffIcon, onSelect: toggle },
    ],
    [kind.hidden, kind.id, onRename, toggle],
  );
  const destructive = useMemo<MenuAction>(
    () => ({ label: customersCopy.kinds.remove, icon: DeleteIcon, onSelect: remove }),
    [remove],
  );

  return (
    <ListRow title={kind.name} detail={kind.hidden ? customersCopy.kinds.hidden : undefined}>
      <ActionMenu label={optionsFor(kind.name)} actions={actions} destructive={destructive} />
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
