import { cookies, headers } from "next/headers";
import { userAgent } from "next/server";

import { ipAddressSchema, type RequestOrigin } from "@/features/access/domain/access-event";
import { setupLinkLifetime } from "@/features/access/domain/access-policy";

import type { CookieToSet } from "./access-commands";
import { ceremonyCookieName, sessionCookieName } from "./cookie-names";
import { deviceLabelFor } from "./device-label";

// The framework side of sign-in for server code: who is asking, and the two cookies

// Lax so a link tapped in Telegram arrives signed in; Fetch Metadata in the proxy covers what Lax lets through
const sessionCookieAttributes = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
} as const;

// Strict: a ceremony is only ever finished from a page of this app
const ceremonyCookieAttributes = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
} as const;

export async function requestOrigin(): Promise<RequestOrigin> {
  const incoming = await headers();
  // Cloudflare sets it on every request that reaches the Worker; local development has none
  const ip = ipAddressSchema.safeParse(incoming.get("cf-connecting-ip"));
  const agent = userAgent({ headers: new Headers(incoming) });

  return {
    ip: ip.success ? ip.data : undefined,
    deviceLabel: deviceLabelFor({ browser: agent.browser.name, os: agent.os.name }),
  };
}

export async function readCookie(name: string): Promise<string | undefined> {
  return (await cookies()).get(name)?.value;
}

export async function setSessionCookie(cookie: CookieToSet): Promise<void> {
  (await cookies()).set(sessionCookieName, cookie.value, {
    ...sessionCookieAttributes,
    maxAge: cookie.maxAgeSeconds,
  });
}

export async function setCeremonyCookie(value: string): Promise<void> {
  (await cookies()).set(ceremonyCookieName, value, {
    ...ceremonyCookieAttributes,
    // The longest a ceremony lives; the server refuses an expired one earlier if it is shorter
    maxAge: setupLinkLifetime.total("seconds"),
  });
}

// A __Host- cookie is only replaced by one with the same attributes, so clearing repeats them
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(sessionCookieName, "", { ...sessionCookieAttributes, maxAge: 0 });
}

export async function clearCeremonyCookie(): Promise<void> {
  (await cookies()).set(ceremonyCookieName, "", { ...ceremonyCookieAttributes, maxAge: 0 });
}
