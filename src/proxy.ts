import { NextResponse, type NextRequest } from "next/server";

import { appOrigin } from "@/composition/daybook";
import { sessionCookieName } from "@/features/access/web/cookie-names";
import {
  contentSecurityPolicy,
  contentSecurityPolicyHeader,
  isCrossSiteWrite,
  needsSignIn,
  newNonce,
  securityHeaders,
} from "@/features/access/web/request-policy";
import { routes } from "@/shared/web/routes";

// Vite's development server injects inline scripts and a websocket; the policy is checked on the production build
const enforcePolicy = process.env.NODE_ENV === "production";

function withHeaders(response: Response, policy: string, https: boolean): Response {
  for (const [name, value] of Object.entries(securityHeaders(policy, https))) {
    if (enforcePolicy || name !== contentSecurityPolicyHeader) {
      response.headers.set(name, value);
    }
  }

  return response;
}

// Runs before every page, server action and route handler; static files are served without it
export default function proxy(request: NextRequest) {
  const nonce = newNonce();
  const policy = contentSecurityPolicy(nonce);
  const https = request.nextUrl.protocol === "https:";

  if (isCrossSiteWrite(request.method, request.headers, appOrigin())) {
    return withHeaders(new Response("Cross-site request refused", { status: 403 }), policy, https);
  }

  if (
    needsSignIn(request.method, request.nextUrl.pathname, request.cookies.has(sessionCookieName))
  ) {
    return withHeaders(NextResponse.redirect(new URL(routes.signIn, appOrigin())), policy, https);
  }

  // vinext reads the policy from the request to stamp its nonce on the scripts it renders
  const forwarded = new Headers(request.headers);
  if (enforcePolicy) {
    forwarded.set(contentSecurityPolicyHeader, policy);
  }

  return withHeaders(NextResponse.next({ request: { headers: forwarded } }), policy, https);
}

export const config = {
  matcher: [
    "/((?!_next/|_vinext/|icons/|manifest\\.webmanifest|icon\\.svg|apple-icon\\.png|favicon\\.ico).*)",
  ],
};
