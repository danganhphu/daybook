import { err } from "@/shared/domain/result";
import { faultMessage } from "@/shared/web/attempt";

import type { Problem, SettingsResult } from "./settings-commands";

const fault: Problem = { code: "fault", message: faultMessage };

// attempt() for the settings: a refusal keeps its code, so the page can tell step-up from the rest; a thrown fault -
// no connection, a server error, a tab older than the last deploy - becomes one plain sentence
export async function attemptSetting<T>(
  call: () => Promise<SettingsResult<T>>,
): Promise<SettingsResult<T>> {
  try {
    return await call();
  } catch {
    return err(fault);
  }
}

// What to show for a refusal. Closing the step-up is not a mistake to point at.
export function problemMessage(problem: Problem): string | undefined {
  return problem.code === "cancelled" ? undefined : problem.message;
}
