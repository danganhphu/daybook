"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type ReactNode } from "react";

import { attemptSetting } from "@/features/access/web/attempt-setting";
import { promptMessages } from "@/features/access/web/prompt-errors";
import type { Problem, SettingsResult } from "@/features/access/web/settings-commands";
import { err } from "@/shared/domain/result";

import { StepUpDialog, type StepUpAccount } from "./step-up-dialog";

const cancelled: Problem = { code: "cancelled", message: promptMessages.cancelled };

export type StepUp = {
  // Runs a settings action. When the server answers that the sign-in is too old, asks the person to confirm and runs
  // it once more. The server decides; the page only follows.
  readonly run: <T>(action: () => Promise<SettingsResult<T>>) => Promise<SettingsResult<T>>;
  // Rendered once by the screen
  readonly dialog: ReactNode;
};

export function useStepUp(account: StepUpAccount): StepUp {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  // Settled by the dialog; outside state because nothing renders from it
  const answer = useRef<PromiseWithResolvers<boolean>>(undefined);

  const onAnswer = useCallback((confirmed: boolean) => {
    answer.current?.resolve(confirmed);
    answer.current = undefined;
    setOpen(false);
  }, []);

  const run = useCallback(
    async <T,>(action: () => Promise<SettingsResult<T>>): Promise<SettingsResult<T>> => {
      const first = await attemptSetting(action);
      if (first.ok || first.error.code !== "step_up_required") {
        return first;
      }

      // A second request while one is open shares its answer rather than stacking dialogs
      const asked = answer.current ?? Promise.withResolvers<boolean>();
      if (answer.current === undefined) {
        answer.current = asked;
        setRound((value) => value + 1);
        setOpen(true);
      }
      if (!(await asked.promise)) {
        return err(cancelled);
      }

      const retried = await attemptSetting(action);
      if (!retried.ok) {
        // The session was replaced; show the page as it now stands
        router.refresh();
      }

      return retried;
    },
    [router],
  );

  return {
    run,
    dialog: <StepUpDialog open={open} round={round} account={account} onAnswer={onAnswer} />,
  };
}
