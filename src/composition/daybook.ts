import { env } from "cloudflare:workers";
import { z } from "zod";

import { appName } from "@/app/identity";
import type { Peppers } from "@/features/access/application/peppers";
import { pepperFitsOrigin } from "@/features/access/infrastructure/development-pepper";
import { pepperSchema, peppersFrom } from "@/features/access/infrastructure/pepper-keys";
import { relyingPartyFor } from "@/features/access/infrastructure/relying-party";
import type { MessageReader } from "@/features/reading/application/message-reader";
import {
  createReplayReader,
  replayTableSchema,
} from "@/features/reading/infrastructure/replay-reader";
import {
  createWorkersAiReader,
  type ModelRunner,
} from "@/features/reading/infrastructure/workers-ai-reader";

import { createApp } from "./create-app";

const bindingsSchema = z
  .object({
    DB: z.custom<D1Database>(
      (value) => typeof value === "object" && value !== null && "prepare" in value,
      { error: "The D1 binding DB is missing" },
    ),
    APP_ORIGIN: z.url({ error: "The APP_ORIGIN secret is missing or not a URL" }),
    PASSWORD_PEPPER: pepperSchema,
    // Workers AI, bound everywhere but in the end-to-end build
    AI: z
      .custom<ModelRunner>((value) => typeof value === "object" && value !== null && "run" in value)
      .optional(),
    // The end-to-end build's stand-in for a model, as JSON: each message its tests send, and what it says
    REPLAY_READINGS: z.string().optional(),
  })
  .refine((parsed) => pepperFitsOrigin(parsed.PASSWORD_PEPPER, parsed.APP_ORIGIN), {
    error: "PASSWORD_PEPPER is the development pepper, which only localhost may use",
  });

type Bindings = Pick<z.infer<typeof bindingsSchema>, "DB"> & {
  readonly appOrigin: URL;
  readonly peppers: Peppers;
  readonly reader: MessageReader | undefined;
};

let checked: Bindings | undefined;

function readerFrom(parsed: z.infer<typeof bindingsSchema>): MessageReader | undefined {
  if (parsed.AI !== undefined) {
    return createWorkersAiReader(parsed.AI);
  }
  if (parsed.REPLAY_READINGS !== undefined) {
    const table = replayTableSchema.parse(JSON.parse(parsed.REPLAY_READINGS));
    return createReplayReader(new Map(Object.entries(table)));
  }

  return undefined;
}

// Read on first use, not when the module loads: the build imports this module to prerender pages, and there are no
// bindings then. A missing one still fails the first request loudly rather than half-working.
function bindings(): Bindings {
  if (checked === undefined) {
    const parsed = bindingsSchema.parse(env);
    checked = {
      DB: parsed.DB,
      appOrigin: new URL(parsed.APP_ORIGIN),
      peppers: peppersFrom(parsed.PASSWORD_PEPPER),
      reader: readerFrom(parsed),
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
  const { DB, appOrigin: origin, peppers, reader } = bindings();

  return createApp({ db: DB, relyingParty: relyingPartyFor(origin, appName), peppers, reader });
}
