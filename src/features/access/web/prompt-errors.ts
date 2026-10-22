import { WebAuthnError } from "@simplewebauthn/browser";

// What to tell the person when the browser's passkey prompt itself fails, before the server sees anything.
// Cancelling is ordinary and gets a gentle line; everything else says what to try.

export const promptMessages = {
  cancelled: "Đã huỷ.",
  alreadyHere: "Máy này đã bật từ trước. Bạn có thể đăng nhập ngay.",
  alreadyAdded: "Máy này đã được thêm rồi.",
  signInFailed: "Không đăng nhập được. Hãy thử lại.",
  setupFailed: "Không bật được. Hãy thử lại, hoặc mở link bằng Safari hay Chrome.",
  addFailed: "Không thêm được. Hãy thử lại.",
  unsupported: "Trình duyệt này không hỗ trợ. Hãy mở bằng Safari hoặc Chrome.",
} as const;

// sign_in: signing in or confirming again; setup: from a setup link; add: one more passkey, from the settings
export type PromptStep = "sign_in" | "setup" | "add";

const failures: Readonly<Record<PromptStep, string>> = {
  sign_in: promptMessages.signInFailed,
  setup: promptMessages.setupFailed,
  add: promptMessages.addFailed,
};

export function promptErrorMessage(error: unknown, step: PromptStep): string {
  // The person closed the prompt, or let it time out (WebAuthn L3, 5.1.3 and 5.1.4: NotAllowedError)
  const name = error instanceof Error ? error.name : undefined;
  const code = error instanceof WebAuthnError ? error.code : undefined;
  if (code === "ERROR_CEREMONY_ABORTED" || name === "NotAllowedError" || name === "AbortError") {
    return promptMessages.cancelled;
  }
  // The authenticator already holds one of the passkeys the server listed to exclude
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
    return step === "add" ? promptMessages.alreadyAdded : promptMessages.alreadyHere;
  }

  return failures[step];
}
