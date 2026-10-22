"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { startTransition, useActionState, useCallback, useEffect, useRef } from "react";

import type { SetupLinkPurpose } from "@/features/access/domain/setup-link";
import type { NamingProblem, SetupView } from "@/features/access/web/access-commands";
import { accessCopy } from "@/features/access/web/access-copy";
import { AccessPanel } from "@/features/access/web/access-panel";
import { forBrowserCreation } from "@/features/access/web/browser-options";
import { enterApp } from "@/features/access/web/enter-app";
import { promptErrorMessage, promptMessages } from "@/features/access/web/prompt-errors";
import { useWebAuthnSupport } from "@/features/access/web/use-webauthn-support";
import { err, type Result } from "@/shared/domain/result";
import { Button } from "@/shared/ui/button/button";
import { attempt, faultMessage } from "@/shared/web/attempt";

import { beginSetup, completeSetup, nameAccount, resumeSetup, retrySetup } from "./actions";
import { BackupPasswordOffer } from "./backup-password-offer";
import { NamingForm, type Naming } from "./naming-form";

type Screen =
  | { readonly kind: "opening" }
  // An invite, waiting for the newcomer to say who they are
  | { readonly kind: "naming"; readonly typed: Naming; readonly problem: NamingProblem | undefined }
  | {
      readonly kind: "ready";
      readonly purpose: SetupLinkPurpose;
      // The username just chosen, when this browser chose it, for the password manager later
      readonly username: string;
      readonly options: PublicKeyCredentialCreationOptionsJSON;
      readonly status: string | undefined;
    }
  // An invite done: the fallback password, which can wait
  | { readonly kind: "offering-password"; readonly username: string }
  // The link cannot be used any more: spent, expired or unknown
  | { readonly kind: "closed"; readonly message: string };

type Intent =
  | { readonly type: "begin"; readonly token: string }
  | { readonly type: "resume" }
  | { readonly type: "name"; readonly naming: Naming }
  | { readonly type: "create" };

const description = "Lần sau mở app chỉ cần một chạm.";

const nobodyYet: Naming = { displayName: "", username: "" };

function fromView(view: Result<SetupView, string>): Screen {
  if (!view.ok) {
    return { kind: "closed", message: view.error };
  }

  return view.value.step.kind === "name"
    ? { kind: "naming", typed: nobodyYet, problem: undefined }
    : {
        kind: "ready",
        purpose: view.value.purpose,
        username: "",
        options: view.value.step.options,
        status: undefined,
      };
}

// attempt() for the naming step, whose refusals belong to fields
async function attemptNaming(
  naming: Naming,
): Promise<Result<PublicKeyCredentialCreationOptionsJSON, NamingProblem>> {
  try {
    return await nameAccount(naming.displayName, naming.username);
  } catch {
    return err({ form: faultMessage });
  }
}

async function create(screen: Extract<Screen, { kind: "ready" }>): Promise<Screen> {
  let failure: string;
  try {
    // Before any other await, so Safari still counts it as the tap's own gesture
    const response = await startRegistration({ optionsJSON: forBrowserCreation(screen.options) });
    const finished = await attempt(() => completeSetup(response));
    if (finished.ok) {
      if (screen.purpose === "invite") {
        return { kind: "offering-password", username: screen.username };
      }
      enterApp();
      return screen;
    }
    failure = finished.error;
  } catch (error) {
    failure = promptErrorMessage(error, "setup");
  }

  // Every answer spends its prompt; ask for another while the setup lasts
  const retry = await attempt(() => retrySetup());

  return retry.ok
    ? { ...screen, options: retry.value, status: failure }
    : { kind: "closed", message: retry.error };
}

// React runs these one at a time, in order
async function act(screen: Screen, intent: Intent): Promise<Screen> {
  if (intent.type === "begin") {
    return fromView(await attempt(() => beginSetup(intent.token)));
  }
  if (intent.type === "resume") {
    return fromView(await attempt(() => resumeSetup()));
  }
  if (intent.type === "name") {
    const named = await attemptNaming(intent.naming);
    return named.ok
      ? {
          kind: "ready",
          purpose: "invite",
          username: intent.naming.username,
          options: named.value,
          status: undefined,
        }
      : { kind: "naming", typed: intent.naming, problem: named.error };
  }

  return screen.kind === "ready" ? create(screen) : screen;
}

// Where a setup link lands: a first setup, an invite or a recovery. The token is in the fragment, which the browser
// never sends anywhere; the page reads it, takes it out of the address bar, and spends it once. Opened again without
// it, the page carries on from the ceremony cookie.
export function SetupScreen() {
  const supported = useWebAuthnSupport();
  const [screen, dispatch, pending] = useActionState(act, { kind: "opening" });
  // A link works once: React's development double-run of effects must not spend it twice
  const begun = useRef(false);

  useEffect(() => {
    // An unsupported browser leaves the link unspent, to be opened again in Safari or Chrome
    if (!supported || begun.current) {
      return;
    }
    begun.current = true;

    const token = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    startTransition(() => dispatch(token === "" ? { type: "resume" } : { type: "begin", token }));
  }, [supported, dispatch]);

  const name = useCallback(
    (naming: Naming) => {
      startTransition(() => dispatch({ type: "name", naming }));
    },
    [dispatch],
  );
  const createPasskey = useCallback(() => {
    startTransition(() => dispatch({ type: "create" }));
  }, [dispatch]);

  if (!supported) {
    return <AccessPanel title={accessCopy.setUpPasskey} description={promptMessages.unsupported} />;
  }

  if (screen.kind === "closed") {
    return <AccessPanel title={accessCopy.setUpPasskey} description={screen.message} />;
  }
  if (screen.kind === "naming") {
    return (
      <NamingForm typed={screen.typed} problem={screen.problem} pending={pending} onName={name} />
    );
  }
  if (screen.kind === "offering-password") {
    return <BackupPasswordOffer username={screen.username} />;
  }

  // Opening, or ready for the tap
  return (
    <AccessPanel
      title={accessCopy.setUpPasskey}
      description={description}
      status={screen.kind === "ready" ? screen.status : undefined}
    >
      <Button
        variant="primary"
        size="lg"
        disabled={pending || screen.kind !== "ready"}
        onClick={createPasskey}
      >
        Bật ngay
      </Button>
    </AccessPanel>
  );
}
