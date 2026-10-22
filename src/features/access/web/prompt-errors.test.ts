import { WebAuthnError } from "@simplewebauthn/browser";
import { describe, expect, it } from "vitest";

import { promptErrorMessage, promptMessages } from "./prompt-errors";

function domError(name: string) {
  return new DOMException("from the browser", name);
}

describe("promptErrorMessage", () => {
  it.each([
    ["the prompt closed by the person", domError("NotAllowedError")],
    ["a prompt aborted", domError("AbortError")],
    [
      "the library's own abort",
      new WebAuthnError({
        message: "aborted",
        code: "ERROR_CEREMONY_ABORTED",
        cause: domError("AbortError"),
      }),
    ],
  ])("given %s, when explained, then it is a gentle cancel", (_, error) => {
    expect(promptErrorMessage(error, "sign_in")).toBe(promptMessages.cancelled);
  });

  it("given an authenticator that already holds the account's passkey, when explained during setup, then it says to sign in with it", () => {
    const error = new WebAuthnError({
      message: "already registered",
      code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
      cause: domError("InvalidStateError"),
    });

    expect(promptErrorMessage(error, "setup")).toBe(promptMessages.alreadyHere);
  });

  it("given an authenticator that already holds the account's passkey, when explained while adding one, then it says it is already there", () => {
    const error = new WebAuthnError({
      message: "already registered",
      code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
      cause: domError("InvalidStateError"),
    });

    expect(promptErrorMessage(error, "add")).toBe(promptMessages.alreadyAdded);
  });

  it.each([
    ["sign_in", promptMessages.signInFailed],
    ["setup", promptMessages.setupFailed],
    ["add", promptMessages.addFailed],
  ] as const)(
    "given anything else during %s, when explained, then it says what to try",
    (step, message) => {
      expect(promptErrorMessage(domError("SecurityError"), step)).toBe(message);
      expect(promptErrorMessage("not even an error", step)).toBe(message);
    },
  );
});
