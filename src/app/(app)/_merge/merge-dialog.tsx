"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useState } from "react";

import type { MergeConfirmView } from "@/features/merging/web/commands";
import { mergingCopy } from "@/features/merging/web/merging-copy";
import type { Result } from "@/shared/domain/result";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { Dialog } from "@/shared/ui/dialog/dialog";
import { SuggestField, type Suggestion } from "@/shared/ui/suggest-field/suggest-field";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";

import styles from "./merge-dialog.module.scss";

export type MergeDialogProps<Item extends { readonly id: string }> = {
  // The question while picking: "Gộp vào khách nào?"
  readonly title: string;
  // What happens to the one being merged
  readonly hint: string;
  readonly label: string;
  readonly emptyText: string;
  // The one being merged, never offered as the one to keep
  readonly fromId: string;
  readonly suggest: (text: string) => Promise<ReadonlyArray<Item>>;
  readonly describe: (item: Item) => Suggestion;
  // What the merge will move, said before it does
  readonly confirm: (intoId: string) => Promise<Result<MergeConfirmView, string>>;
  // Answers the kept one's id
  readonly merge: (intoId: string) => Promise<Result<string, string>>;
  readonly keptPath: (id: string) => string;
  // The toast once merged
  readonly done: string;
  readonly onClose: () => void;
};

type Step =
  | { readonly kind: "pick" }
  | { readonly kind: "confirm"; readonly intoId: string; readonly view: MergeConfirmView };

// Two steps: pick the one to keep, then read what will move and confirm. A merge cannot be undone, which is why this
// asks first, unlike every other change in the app. Mounted when it opens.
export function MergeDialog<Item extends { readonly id: string }>({
  title,
  hint,
  label,
  emptyText,
  fromId,
  suggest,
  describe,
  confirm,
  merge,
  keptPath,
  done,
  onClose,
}: MergeDialogProps<Item>) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();

  const others = useCallback(
    async (typed: string) => (await suggest(typed)).filter((item) => item.id !== fromId),
    [fromId, suggest],
  );
  const type = useCallback((typed: string) => {
    setText(typed);
    setError(undefined);
  }, []);
  const pick = useCallback(
    (item: Item) => {
      startTransition(async () => {
        const result = await attempt(() => confirm(item.id));
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setStep({ kind: "confirm", intoId: item.id, view: result.value });
      });
    },
    [confirm],
  );

  const run = useCallback(() => {
    if (step.kind !== "confirm") {
      return;
    }
    onClose();
    startTransition(async () => {
      const result = await attempt(() => merge(step.intoId));
      if (!result.ok) {
        toast.show({ title: result.error });
        return;
      }
      toast.show({ title: done });
      router.push(keptPath(result.value));
    });
  }, [done, keptPath, merge, onClose, router, step, toast]);

  if (step.kind === "confirm") {
    return (
      <ConfirmDialog
        open
        title={step.view.title}
        description={step.view.description}
        confirmLabel={mergingCopy.confirm}
        onConfirm={run}
        onClose={onClose}
      />
    );
  }

  return (
    <Dialog open onClose={onClose} title={title} description={hint}>
      <div className={styles.form}>
        <SuggestField
          label={label}
          value={text}
          onValueChange={type}
          suggest={others}
          describe={describe}
          onPick={pick}
          emptyText={emptyText}
          error={error}
          focusOnMount
        />
        <Button size="lg" onClick={onClose}>
          {actionLabels.cancel}
        </Button>
      </div>
    </Dialog>
  );
}
