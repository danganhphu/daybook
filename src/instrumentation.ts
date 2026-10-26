// One JSON line per fault, in Workers Logs (cloudflare.config.ts): in production vinext writes nothing for a failed
// render. Never the headers (the session cookie) or the path (search words in its query); of each error, its name and
// first line - Drizzle puts a failed query's parameters on the lines after.

type FailedRequest = { readonly method: string };

type FailureContext = { readonly routePath: string; readonly routeType: string };

type ErrorLine = { readonly name: string; readonly message: string };

// Errors wrap errors: Drizzle's wraps D1's, which says what actually went wrong
const causesKept = 4;
const messageKept = 200;

function chain(error: unknown): ReadonlyArray<ErrorLine> {
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
      errors: chain(error),
    }),
  );
}
