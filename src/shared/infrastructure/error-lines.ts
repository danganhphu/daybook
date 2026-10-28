export type ErrorLine = { readonly name: string; readonly message: string };

// Errors wrap errors: Drizzle's wraps D1's, which says what actually went wrong
const causesKept = 4;
const messageKept = 200;

// Of each error in the chain, its name and first line: Drizzle puts a failed query's parameters on the lines after
export function errorLines(error: unknown): ReadonlyArray<ErrorLine> {
  const found: ErrorLine[] = [];
  let current = error;
  while (current instanceof Error && found.length < causesKept) {
    found.push({
      name: current.name,
      message: (current.message.split("\n", 1)[0] ?? "").slice(0, messageKept),
    });
    current = current.cause;
  }

  return found;
}
