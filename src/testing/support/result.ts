import type { Result } from "@/shared/domain/result";

// Narrows a Result in a test, failing with the error when it is not ok
export function expectOk<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error(`Expected ok, got error ${JSON.stringify(result.error)}`);
  }

  return result.value;
}

// Narrows a value a test knows is there, failing when it is not
export function expectDefined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected a value, got undefined");
  }

  return value;
}
