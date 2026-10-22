import { redirect } from "next/navigation";

import type { App } from "@/composition/create-app";
import type { Session } from "@/features/access/domain/session";
import { routes } from "@/shared/web/routes";

import { sessionCookieName } from "./cookie-names";
import { readCookie } from "./request-context";

// The session this request's cookie proves, if any
export async function currentSession(app: App): Promise<Session | undefined> {
  const authenticated = await app.authenticate(await readCookie(sessionCookieName));

  return authenticated.ok ? authenticated.value : undefined;
}

// Every page and every server action that touches the book starts here. Without a session it sends the browser to
// sign in; it never answers with data. The proxy's early redirect is only a shortcut, this is the check.
export async function requireSession(app: App): Promise<Session> {
  const session = await currentSession(app);
  if (session === undefined) {
    redirect(routes.signIn);
  }

  return session;
}
