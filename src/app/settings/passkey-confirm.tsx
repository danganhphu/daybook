"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { startTransition, useActionState, useCallback, useEffect } from "react";

import { attemptSetting } from "@/features/access/web/attempt-setting";
import { forBrowserRequest } from "@/features/access/web/browser-options";
import { promptErrorMessage } from "@/features/access/web/prompt-errors";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { Status } from "@/shared/ui/status/status";

import { completeStepUp, prepareStepUp } from "./actions";

type Prompt = {
  // Held ready for the tap; none while it is fetched or after a failure to fetch
  readonly options: PublicKeyCredentialRequestOptionsJSON | undefined;
  readonly status: string | undefined;
};

type Intent = "prepare" | "confirm";

const waiting: Prompt = { options: undefined, status: undefined };

async function withFreshPrompt(status: string | undefined): Promise<Prompt> {
  const prompt = await attemptSetting(() => prepareStepUp());

  return prompt.ok
    ? { options: prompt.value, status }
    : { options: undefined, status: status ?? prompt.error.message };
}

// Confirming with a passkey of this account. The prompt is fetched as the dialog opens, so the tap goes straight to
// Face ID (Safari needs the gesture unbroken); a success replaces the session with a fresh one.
export function PasskeyConfirm({ onConfirmed }: { readonly onConfirmed: () => void }) {
  const [prompt, dispatch, pending] = useActionState(
    async (current: Prompt, intent: Intent): Promise<Prompt> => {
      if (intent === "prepare") {
        return withFreshPrompt(undefined);
      }
      if (current.options === undefined) {
        return current;
      }

      let failure: string;
      try {
        const response = await startAuthentication({
          optionsJSON: forBrowserRequest(current.options),
        });
        const fresh = await attemptSetting(() => completeStepUp(response));
        if (fresh.ok) {
          onConfirmed();
          return waiting;
        }
        failure = fresh.error.message;
      } catch (error) {
        failure = promptErrorMessage(error, "sign_in");
      }

      // The prompt is spent whatever happened; hold a fresh one for the next tap
      return withFreshPrompt(failure);
    },
    waiting,
  );

  useEffect(() => {
    startTransition(() => dispatch("prepare"));
  }, [dispatch]);

  const confirm = useCallback(() => {
    startTransition(() => dispatch("confirm"));
  }, [dispatch]);

  return (
    <>
      <Status message={prompt.status} />
      <Button
        variant="primary"
        size="lg"
        disabled={pending || prompt.options === undefined}
        onClick={confirm}
      >
        {actionLabels.confirm}
      </Button>
    </>
  );
}
