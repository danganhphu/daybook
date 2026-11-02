import { z } from "zod";

import { errorLines } from "@/shared/infrastructure/error-lines";
import { logEvent } from "@/shared/infrastructure/log-event";

import { vapidKeysFitOrigin, vapidPrivateKeySchema, vapidPublicKeySchema } from "./vapid-keys";

export const vapidBindingsSchema = z.object({
  VAPID_PUBLIC_KEY: vapidPublicKeySchema.optional(),
  VAPID_PRIVATE_KEY: vapidPrivateKeySchema.optional(),
});

export type VapidPair = { readonly publicKey: string; readonly privateKey: string };

// Both halves or neither: with neither, nothing is sent and Settings does not offer notifications. One half alone, or
// the development pair on a real origin, is an error.
export function vapidPairFrom(
  parsed: z.infer<typeof vapidBindingsSchema>,
  appOrigin: string,
): VapidPair | undefined {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = parsed;
  if (publicKey === undefined && privateKey === undefined) {
    return undefined;
  }
  if (publicKey === undefined || privateKey === undefined) {
    throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set together or not at all");
  }
  if (!vapidKeysFitOrigin(publicKey, appOrigin)) {
    throw new Error("The VAPID keys are the development pair, which only localhost may use");
  }

  return { publicKey, privateKey };
}

// For the Worker: push is optional, so keys set wrongly - one half, the development pair, a malformed key - turn
// push off and say so in the logs, while the app keeps working. `wrangler secret put` deploys at once, so setting the
// pair one key at a time runs a version with one of them.
export function vapidPairOrOff(env: unknown, appOrigin: string): VapidPair | undefined {
  try {
    return vapidPairFrom(vapidBindingsSchema.parse(env), appOrigin);
  } catch (error) {
    logEvent("push_misconfigured", { errors: errorLines(error) });
    return undefined;
  }
}
