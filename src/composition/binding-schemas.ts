import { z } from "zod";

// The Worker's bindings every composition root checks the same way, each failing with words that say which is missing

export const d1Binding = z.custom<D1Database>(
  (value) => typeof value === "object" && value !== null && "prepare" in value,
  { error: "The D1 binding DB is missing" },
);

export const queueBinding = z.custom<Queue>(
  (value) => typeof value === "object" && value !== null && "sendBatch" in value,
  { error: "The queue binding JOBS is missing" },
);

export const appOriginBinding = z.url({ error: "The APP_ORIGIN secret is missing or not a URL" });
