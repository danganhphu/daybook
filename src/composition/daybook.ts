import { env } from "cloudflare:workers";
import { z } from "zod";

import { createApp } from "./create-app";

// Checked when the Worker loads this module, so a missing binding fails at once instead of on the first note
const bindings = z
  .object({
    DB: z.custom<D1Database>(
      (value) => typeof value === "object" && value !== null && "prepare" in value,
      { error: "The D1 binding DB is missing" },
    ),
  })
  .parse(env);

// The app over the Worker's real bindings, for server code: pages and server actions
export function daybook() {
  return createApp(bindings.DB);
}
