// A text field's value from a form action's FormData; a missing field or a file is empty text
export function formText(form: FormData, name: string): string {
  const value = form.get(name);

  return typeof value === "string" ? value : "";
}
