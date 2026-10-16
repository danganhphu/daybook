import type { Result } from "../../core/domain/shared/result";

// Narrows a Result in a test, failing with the error when it is not ok
export function expectOk<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error(`Expected ok, got error ${JSON.stringify(result.error)}`);
  }

  return result.value;
}
