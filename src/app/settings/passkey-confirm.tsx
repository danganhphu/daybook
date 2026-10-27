"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useCallback, useEffect, useState } from "react";

import { attemptSetting } from "@/features/access/web/attempt-setting";
import { forBrowserRequest } from "@/features/access/web/browser-options";
import { promptErrorMessage } from "@/features/access/web/prompt-errors";
import { usePromptRefresh } from "@/features/access/web/use-prompt-refresh";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { Status } from "@/shared/ui/status/status";

import { completeStepUp, prepareStepUp } from "./actions";

type Prompt = {
  // Held ready for the tap; none while it is fetched or after a failure to fetch
  readonly options: PublicKeyCredentialRequestOptionsJSON | undefined;
  readonly status: string | undefined;
};

async function withFreshPrompt(status: string | undefined): Promise<Prompt> {
  const prompt = await attemptSetting(() => prepareStepUp());

  return prompt.ok
    ? { options: prompt.value, status }
    : { options: undefined, status: status ?? prompt.error.message };
}

// The prompt is fetched as the dialog opens, so the tap goes straight to Face ID (Safari needs the gesture unbroken).
// Plain state, not a transition: the action that opened it is a transition waiting on it (use-step-up.tsx).
export function PasskeyConfirm({ onConfirmed }: { readonly onConfirmed: () => void }) {
  const [prompt, setPrompt] = useState<Prompt>({ options: undefined, status: undefined });
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let open = true;
    void (async () => {
      const fresh = await withFreshPrompt(undefined);
      if (open) {
        setPrompt(fresh);
        setBusy(false);
      }
    })();

    return () => {
      open = false;
    };
  }, []);

  const refresh = useCallback(() => {
    void (async () => setPrompt(await withFreshPrompt(undefined)))();
  }, []);
  usePromptRefresh(prompt.options, refresh);

  const confirm = useCallback(
    async (options: PublicKeyCredentialRequestOptionsJSON) => {
      setBusy(true);
      let failure: string;
      try {
        const response = await startAuthentication({ optionsJSON: forBrowserRequest(options) });
        const fresh = await attemptSetting(() => completeStepUp(response));
        if (fresh.ok) {
          onConfirmed();
          return;
        }
        failure = fresh.error.message;
      } catch (error) {
        failure = promptErrorMessage(error, "sign_in");
      }

      // The prompt is spent whatever happened; hold a fresh one for the next tap
      setPrompt(await withFreshPrompt(failure));
      setBusy(false);
    },
    [onConfirmed],
  );

  const tap = useCallback(() => {
    if (prompt.options !== undefined) {
      void confirm(prompt.options);
    }
  }, [confirm, prompt.options]);

  return (
    <>
      <Status message={prompt.status} />
      <Button
        variant="primary"
        size="lg"
        disabled={busy || prompt.options === undefined}
        onClick={tap}
      >
        {actionLabels.confirm}
      </Button>
    </>
  );
}
