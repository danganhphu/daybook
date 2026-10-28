import { z } from "zod";

import { vapidKeysFitOrigin, vapidPrivateKeySchema, vapidPublicKeySchema } from "./vapid-keys";

export const vapidBindingsSchema = z.object({
  VAPID_PUBLIC_KEY: vapidPublicKeySchema.optional(),
  VAPID_PRIVATE_KEY: vapidPrivateKeySchema.optional(),
});

export type VapidPair = { readonly publicKey: string; readonly privateKey: string };

// Both halves or neither: with neither, nothing is sent and Settings does not offer notifications. One half alone, or
// the development pair on a real origin, fails the first request loudly, as a missing pepper does.
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
