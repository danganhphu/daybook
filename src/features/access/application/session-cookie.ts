import { secretTokenSchema, type SecretToken } from "@/features/access/domain/secret";
import { sessionIdSchema, type SessionId } from "@/features/access/domain/session";

// The cookie's value is "<session id>.<secret>": the id finds the row, the secret proves the browser holds it.
// The id alone is never proof (OWASP Session Management cheat sheet, "Server-Side Session Token Storage").
export type SessionCookie = {
  readonly sessionId: SessionId;
  readonly secret: SecretToken;
};

export function formatSessionCookie(cookie: SessionCookie): string {
  return `${cookie.sessionId}.${cookie.secret}`;
}

// Anything that is not exactly an id and a secret is no cookie at all
export function parseSessionCookie(value: string): SessionCookie | undefined {
  const [id, secret, ...rest] = value.split(".");
  const sessionId = sessionIdSchema.safeParse(id);
  const token = secretTokenSchema.safeParse(secret);
  if (rest.length > 0 || !sessionId.success || !token.success) {
    return undefined;
  }

  return { sessionId: sessionId.data, secret: token.data };
}
