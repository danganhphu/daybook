import { ceremonyIdSchema, type CeremonyId } from "@/features/access/domain/ceremony";
import { secretTokenSchema, type SecretToken } from "@/features/access/domain/secret";

// "<ceremony id>.<binding>", the same shape as the session cookie: the id finds the row, the binding proves this
// browser started it
export type CeremonyCookie = {
  readonly ceremonyId: CeremonyId;
  readonly binding: SecretToken;
};

export function formatCeremonyCookie(cookie: CeremonyCookie): string {
  return `${cookie.ceremonyId}.${cookie.binding}`;
}

export function parseCeremonyCookie(value: string): CeremonyCookie | undefined {
  const [id, binding, ...rest] = value.split(".");
  const ceremonyId = ceremonyIdSchema.safeParse(id);
  const token = secretTokenSchema.safeParse(binding);
  if (rest.length > 0 || !ceremonyId.success || !token.success) {
    return undefined;
  }

  return { ceremonyId: ceremonyId.data, binding: token.data };
}
