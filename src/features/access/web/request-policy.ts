import { routes } from "@/shared/web/routes";

// What the proxy decides for every request, without the framework, so each rule is tested on its own.
// Sources: OWASP CSRF Prevention cheat sheet (Fetch Metadata, Origin); OWASP HTTP Headers and Secure Headers
// projects; CSP Level 3 (nonces, strict-dynamic); ADR 0009, decisions 7 and 10.

export const contentSecurityPolicyHeader = "content-security-policy";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

// Pages a signed-out browser may open, and the manifest and icons the sign-in page names. Everything else sends it to
// sign in first. The component gallery holds no data and answers 404 in production.
const publicPaths = new Set<string>([
  routes.signIn,
  routes.setup,
  routes.signOut,
  routes.componentGallery,
  routes.manifest,
  routes.icon,
  routes.appleIcon,
]);

// What the build and vinext serve, which holds none of the book: never sent to sign in, so a missing file answers 404
const publicPrefixes = ["/_next/", "/_vinext/", "/icons/"] as const;

type HeaderReader = { get(name: string): string | null };

// A write from another site - a form, a fetch, a server action - is refused before anything runs. Browsers send
// Sec-Fetch-Site on every request since 2023; when it is missing, Origin must be this app's own, which comes from
// configuration and never from the Host header.
export function isCrossSiteWrite(method: string, headers: HeaderReader, appOrigin: URL): boolean {
  if (safeMethods.has(method.toUpperCase())) {
    return false;
  }

  const site = headers.get("sec-fetch-site");
  if (site !== null) {
    return site !== "same-origin";
  }

  return headers.get("origin") !== appOrigin.origin;
}

// Only a shortcut: a missing cookie means no session, so there is no point rendering the page first. A cookie that
// is present proves nothing; the page and every server action still check it.
export function needsSignIn(method: string, pathname: string, hasSessionCookie: boolean): boolean {
  return (
    method.toUpperCase() === "GET" &&
    !hasSessionCookie &&
    !publicPaths.has(pathname) &&
    !publicPrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}

// Scripts and styles run only with this request's nonce; vinext puts it on everything it emits. strict-dynamic lets
// those scripts load the chunks they import, and nothing else.
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self'",
    "font-src 'self'",
    // The breach check for a new password runs in the browser, against Have I Been Pwned's range API
    "connect-src 'self' https://api.pwnedpasswords.com",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function securityHeaders(policy: string, https: boolean): Readonly<Record<string, string>> {
  return {
    [contentSecurityPolicyHeader]: policy,
    // Setup tokens live in the fragment, which is never sent; this keeps every other URL out of other sites' logs
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    // Passkeys from this origin only; nothing the app never uses
    "permissions-policy":
      "publickey-credentials-get=(self), publickey-credentials-create=(self), camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    // Everything a session can see stays out of shared caches and the back-forward cache's disk
    "cache-control": "private, no-store",
    ...(https ? { "strict-transport-security": "max-age=63072000; includeSubDomains" } : {}),
  };
}

// 128 random bits per response (CSP Level 3, 7.3)
export function newNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}
