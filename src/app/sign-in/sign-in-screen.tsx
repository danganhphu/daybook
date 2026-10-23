"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { startTransition, useActionState, useCallback, useEffect, useState } from "react";

import { passkeyTerm } from "@/features/access/application/access-terms";
import { accessCopy } from "@/features/access/web/access-copy";
import { AccessPanel } from "@/features/access/web/access-panel";
import { forBrowserRequest } from "@/features/access/web/browser-options";
import { enterApp } from "@/features/access/web/enter-app";
import { promptErrorMessage } from "@/features/access/web/prompt-errors";
import { useWebAuthnSupport } from "@/features/access/web/use-webauthn-support";
import { Button } from "@/shared/ui/button/button";
import { attempt } from "@/shared/web/attempt";
import { useHydrated } from "@/shared/web/use-hydrated";

import { completeSignIn, prepareSignIn } from "./actions";
import { PasswordForm } from "./password-form";

type Screen = {
  // The prompt held ready for the next tap; none while one is being fetched or after a failure to fetch
  readonly options: PublicKeyCredentialRequestOptionsJSON | undefined;
  readonly status: string | undefined;
};

type Intent = "prepare" | "sign-in";

const waiting: Screen = { options: undefined, status: undefined };

const passwordInstead = `Trình duyệt này không dùng được ${passkeyTerm}. Hãy đăng nhập bằng mật khẩu.`;

async function withFreshPrompt(status: string | undefined): Promise<Screen> {
  const prompt = await attempt(() => prepareSignIn());

  return prompt.ok
    ? { options: prompt.value, status }
    : { options: undefined, status: status ?? prompt.error };
}

// React runs these one at a time, in order: a tap can never race the prompt it needs
async function act(screen: Screen, intent: Intent): Promise<Screen> {
  if (intent === "prepare") {
    return withFreshPrompt(undefined);
  }
  if (screen.options === undefined) {
    return screen;
  }

  let failure: string;
  try {
    // Before any other await, so Safari still counts it as the tap's own gesture
    const response = await startAuthentication({ optionsJSON: forBrowserRequest(screen.options) });
    const signedIn = await attempt(() => completeSignIn(response));
    if (signedIn.ok) {
      enterApp();
      return waiting;
    }
    failure = signedIn.error;
  } catch (error) {
    failure = promptErrorMessage(error, "sign_in");
  }

  // The prompt is spent whatever happened; hold a fresh one for the next tap
  return withFreshPrompt(failure);
}

// One button. The prompt is fetched before the tap, so the tap goes straight to Face ID or the fingerprint.
export function SignInScreen() {
  const supported = useWebAuthnSupport();
  const [mode, setMode] = useState<"passkey" | "password">("passkey");
  const toPassword = useCallback(() => setMode("password"), []);
  const toPasskey = useCallback(() => setMode("passkey"), []);
  const [screen, dispatch, pending] = useActionState(act, waiting);
  const hydrated = useHydrated();

  useEffect(() => {
    if (supported) {
      startTransition(() => dispatch("prepare"));
    }
  }, [supported, dispatch]);

  const signIn = useCallback(() => {
    startTransition(() => dispatch("sign-in"));
  }, [dispatch]);

  // The fallback, chosen or the only way on a browser without passkeys
  if (!supported || mode === "password") {
    return (
      <AccessPanel
        title={accessCopy.signIn}
        description={supported ? "Dùng tên đăng nhập và mật khẩu." : passwordInstead}
      >
        <PasswordForm />
        {supported ? (
          <Button variant="quiet" onClick={toPasskey}>
            {accessCopy.withPasskey}
          </Button>
        ) : null}
      </AccessPanel>
    );
  }

  return (
    <AccessPanel
      title={accessCopy.signIn}
      description={`${accessCopy.withPasskey}.`}
      status={screen.status}
    >
      <Button
        variant="primary"
        size="lg"
        disabled={pending || screen.options === undefined}
        onClick={signIn}
      >
        {accessCopy.signIn}
      </Button>
      {/* A tap before the page has hydrated would do nothing, so it waits like the button above */}
      <Button variant="quiet" disabled={!hydrated} onClick={toPassword}>
        Dùng mật khẩu
      </Button>
    </AccessPanel>
  );
}
