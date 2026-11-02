import type { ErrorLine } from "./error-lines";

// What a line may carry: ids, counts, codes, a host, an error's first lines (errorLines). Never the words she wrote, a
// URL with a token in it, a cookie, a key or a secret.
export type LogFields = Readonly<
  Record<string, string | number | boolean | undefined | ReadonlyArray<ErrorLine>>
>;

// One line of Workers Logs per thing that went wrong, as JSON, so a query picks it by its event
export function logEvent(event: string, fields: LogFields = {}): void {
  console.error(JSON.stringify({ event, ...fields }));
}

// The same for what went right and is worth a line
export function logInfo(event: string, fields: LogFields = {}): void {
  console.log(JSON.stringify({ event, ...fields }));
}
