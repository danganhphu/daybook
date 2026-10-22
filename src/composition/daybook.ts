import { env } from "cloudflare:workers";
import { z } from "zod";

import { appName } from "@/app/identity";
import type { Peppers } from "@/features/access/application/peppers";
import { pepperSchema, peppersFrom } from "@/features/access/infrastructure/pepper-keys";
import { relyingPartyFor } from "@/features/access/infrastructure/simple-webauthn-verifier";

import { createApp } from "./create-app";

const bindingsSchema = z.object({
  DB: z.custom<D1Database>(
    (value) => typeof value === "object" && value !== null && "prepare" in value,
    { error: "The D1 binding DB is missing" },
  ),
  APP_ORIGIN: z.url({ error: "The APP_ORIGIN secret is missing or not a URL" }),
  PASSWORD_PEPPER: pepperSchema,
});

type Bindings = z.infer<typeof bindingsSchema> & {
  readonly appOrigin: URL;
  readonly peppers: Peppers;
};

let checked: Bindings | undefined;

// Read on first use, not when the module loads: the build imports this module to prerender pages, and there are no
// bindings then. A missing one still fails the first request loudly rather than half-working.
function bindings(): Bindings {
  if (checked === undefined) {
    const parsed = bindingsSchema.parse(env);
    checked = {
      ...parsed,
      appOrigin: new URL(parsed.APP_ORIGIN),
      peppers: peppersFrom(parsed.PASSWORD_PEPPER),
    };
  }

  return checked;
}

// The address the app is served from, as configured - never as a request's Host header claims
export function appOrigin(): URL {
  return bindings().appOrigin;
}

// The app over the Worker's real bindings, for server code: pages and server actions
export function daybook() {
  const { DB, appOrigin: origin, peppers } = bindings();

  return createApp({ db: DB, relyingParty: relyingPartyFor(origin, appName), peppers });
}
