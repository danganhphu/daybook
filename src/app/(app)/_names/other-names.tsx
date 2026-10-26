"use client";

import { startTransition, useCallback, useOptimistic, useState } from "react";

import type { Result } from "@/shared/domain/result";
import { IconButton } from "@/shared/ui/button/icon-button";
import { AddIcon, CloseIcon } from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListAction } from "@/shared/ui/list/list-action";
import { ListRow } from "@/shared/ui/list/list-row";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import type { OtherNameView } from "@/shared/web/other-name-view";

import { NameDialog } from "./name-dialog";
import { otherNamesCopy, removeName } from "./other-names-copy";

export type OtherNamesProps = {
  readonly names: ReadonlyArray<OtherNameView>;
  // What the names are for, under the card
  readonly footer: string;
  readonly maxLength: number;
  // Off for a hidden customer or product: names are for what is in use
  readonly editable: boolean;
  readonly add: (name: string) => Promise<Result<null, string>>;
  readonly remove: (id: string) => Promise<Result<null, string>>;
};

function without(names: ReadonlyArray<OtherNameView>, id: string) {
  return names.filter((name) => name.id !== id);
}

// The other names a customer or product is known by: what a message or an order line may call it. A name goes at
// once on a tap; the page refreshes with the server's list.
export function OtherNames({ names, footer, maxLength, editable, add, remove }: OtherNamesProps) {
  const toast = useToast();
  const [shown, hide] = useOptimistic(names, without);
  const [adding, setAdding] = useState(false);
  const open = useCallback(() => setAdding(true), []);
  const close = useCallback(() => setAdding(false), []);
  const added = useCallback(() => toast.show({ title: otherNamesCopy.added }), [toast]);

  const drop = useCallback(
    (name: OtherNameView) => {
      startTransition(async () => {
        hide(name.id);
        const result = await attempt(() => remove(name.id));
        toast.show(
          result.ok
            ? { title: otherNamesCopy.removed, description: name.name }
            : { title: result.error },
        );
      });
    },
    [hide, remove, toast],
  );

  if (!editable && shown.length === 0) {
    return null;
  }

  return (
    <>
      <List heading={otherNamesCopy.title} footer={footer}>
        {shown.map((name) => (
          <NameRow key={name.id} name={name} onRemove={editable ? drop : undefined} />
        ))}
        {editable ? <ListAction label={otherNamesCopy.add} icon={AddIcon} onClick={open} /> : null}
      </List>
      {adding ? (
        <NameDialog
          title={otherNamesCopy.add}
          label={otherNamesCopy.name}
          maxLength={maxLength}
          save={add}
          onSaved={added}
          onClose={close}
        />
      ) : null}
    </>
  );
}

function NameRow({
  name,
  onRemove,
}: {
  readonly name: OtherNameView;
  readonly onRemove: ((name: OtherNameView) => void) | undefined;
}) {
  const remove = useCallback(() => onRemove?.(name), [name, onRemove]);

  return (
    <ListRow title={name.name}>
      {onRemove === undefined ? null : (
        <IconButton icon={CloseIcon} label={removeName(name.name)} onClick={remove} />
      )}
    </ListRow>
  );
}
