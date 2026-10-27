import { z } from "zod";

import type { Result } from "./result";

// The Zod schema for a value whose rule is plain code, kept plain so the browser can run it without loading Zod. A
// refusal becomes an issue carrying the rule's own sentence.
export function checkedSchema<I, O>(input: z.ZodType<I>, check: (value: I) => Result<O, string>) {
  return input.transform((value, context) => {
    const checked = check(value);
    if (!checked.ok) {
      context.addIssue(checked.error);
      return z.NEVER;
    }

    return checked.value;
  });
}
