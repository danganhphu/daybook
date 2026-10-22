import { problemMessage } from "@/features/access/web/attempt-setting";
import {
  checkPasswordLength,
  deriveKey,
  isBreached,
  normalizePassword,
  passwordMessages,
} from "@/features/access/web/browser-password";
import { err, ok, type Result } from "@/shared/domain/result";

import { beginSettingPassword, finishSettingPassword } from "./actions";
import type { StepUp } from "./use-step-up";

// Sets or changes the fallback password, from the settings or right after an invite's setup. Checked here first, so
// a short or leaked password never costs a step-up or a round trip; only the browser can check the password itself,
// and the server sees only the key Argon2id derives from it. The refusal is the sentence to show, or nothing after a
// cancelled step-up.
export async function saveBackupPassword(
  text: string,
  run: StepUp["run"],
): Promise<Result<null, string | undefined>> {
  const normalized = normalizePassword(text);
  const length = checkPasswordLength(normalized);
  if (!length.ok) {
    return length;
  }
  try {
    if (await isBreached(normalized)) {
      return err(passwordMessages.breached);
    }
  } catch {
    return err(passwordMessages.uncheckable);
  }

  const prompt = await run(() => beginSettingPassword());
  if (!prompt.ok) {
    return err(problemMessage(prompt.error));
  }
  const key = await deriveKey(normalized, prompt.value.salt, prompt.value.parameters);
  const saved = await run(() => finishSettingPassword(key));

  return saved.ok ? ok(null) : err(problemMessage(saved.error));
}
