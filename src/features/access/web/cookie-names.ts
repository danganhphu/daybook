// The two cookies sign-in uses. __Host- makes the browser insist on Secure, Path=/ and no Domain, so no other host can
// set or read them. Apart from request-context.ts so the proxy can name them without the request APIs.
export const sessionCookieName = "__Host-session";
export const ceremonyCookieName = "__Host-ceremony";
