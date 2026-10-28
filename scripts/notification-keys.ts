// A new key pair for Web Push, as JSON, for the operator to set as the Worker's two secrets
// (docs/guides/deployment.md). Each deploy keeps its pair: a new one stops every browser's subscription working.
import { newVapidKeys } from "@/features/notifications/infrastructure/vapid-keys";

const keys = await newVapidKeys();
process.stdout.write(
  `${JSON.stringify({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey })}\n`,
);
