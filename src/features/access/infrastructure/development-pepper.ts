// The pepper `pnpm dev` runs with, as cloudflare.config.ts gives it (its own copy; the test holds them together). It is
// in a public repository and guards nothing, so the Worker refuses it on any origin but localhost: a deploy given it by
// mistake fails its first request instead of running with it.
export const developmentPepper = "ZGF5Ym9vay1kZXZlbG9wbWVudC1wZXBwZXItbm90LWE";

export function pepperFitsOrigin(pepper: string, appOrigin: string): boolean {
  return pepper !== developmentPepper || new URL(appOrigin).hostname === "localhost";
}
