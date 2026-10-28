// One JSON line per fault, in Workers Logs (cloudflare.config.ts): in production vinext writes nothing for a failed
// render. Never the headers (the session cookie) or the path (search words in its query); of each error, its name and
// first line (error-lines.ts).

import { errorLines } from "@/shared/infrastructure/error-lines";

type FailedRequest = { readonly method: string };

type FailureContext = { readonly routePath: string; readonly routeType: string };

function digestOf(error: unknown): string | undefined {
  const digest: unknown =
    typeof error === "object" && error !== null ? Reflect.get(error, "digest") : undefined;

  return typeof digest === "string" ? digest : undefined;
}

export function onRequestError(
  error: unknown,
  request: FailedRequest,
  context: FailureContext,
): void {
  console.error(
    JSON.stringify({
      event: "request_failed",
      route: context.routePath,
      during: context.routeType,
      method: request.method,
      digest: digestOf(error),
      errors: errorLines(error),
    }),
  );
}
