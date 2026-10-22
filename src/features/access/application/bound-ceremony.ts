import type { Ceremony, CeremonyKind } from "@/features/access/domain/ceremony";
import type { CeremonyRepository } from "@/features/access/domain/ceremony-repository";

import { parseCeremonyCookie } from "./ceremony-cookie";
import { secretTokenMatches } from "./secret-tokens";
import type { Secrets } from "./secrets";

export type BoundCeremonyDeps = {
  readonly secrets: Secrets;
  readonly ceremonies: CeremonyRepository;
};

// The ceremony of this kind that the browser's cookie names and proves. A missing, malformed or forged cookie, or
// one for another kind of step, finds nothing.
export async function findBoundCeremony(
  deps: BoundCeremonyDeps,
  cookie: string | undefined,
  kind: CeremonyKind,
): Promise<Ceremony | undefined> {
  const presented = cookie === undefined ? undefined : parseCeremonyCookie(cookie);
  if (presented === undefined) {
    return undefined;
  }

  const ceremony = await deps.ceremonies.get(presented.ceremonyId);
  if (
    ceremony === undefined ||
    ceremony.kind !== kind ||
    !(await secretTokenMatches(deps.secrets, presented.binding, ceremony.bindingHash))
  ) {
    return undefined;
  }

  return ceremony;
}
