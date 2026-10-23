import type { z } from "zod";

// What a form action answers when it does not move on: a sentence for the whole form, one per field, and what was
// typed, so the fields show it again after React resets the form
export type FormState<Field extends string> = {
  readonly error?: string;
  readonly fieldErrors?: Partial<Record<Field, string>>;
  readonly values?: Partial<Record<Field, string>>;
};

// The first message for each field a schema refused, keyed by the field's name
export function fieldErrors<Field extends string>(
  error: z.ZodError,
  fields: ReadonlyArray<Field>,
): Partial<Record<Field, string>> {
  const found: Partial<Record<Field, string>> = {};
  for (const issue of error.issues) {
    const [field] = issue.path;
    const known = fields.find((name) => name === field);
    if (known !== undefined && found[known] === undefined) {
      found[known] = issue.message;
    }
  }

  return found;
}

// The text of each named field, to send back with a refusal
export function formValues<Field extends string>(
  form: FormData,
  fields: ReadonlyArray<Field>,
): Partial<Record<Field, string>> {
  const values: Partial<Record<Field, string>> = {};
  for (const field of fields) {
    const value = form.get(field);
    values[field] = typeof value === "string" ? value : "";
  }

  return values;
}
