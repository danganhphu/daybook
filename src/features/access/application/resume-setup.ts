import * as Ceremonies from "@/features/access/domain/ceremony";
import type { SetupLinkPurpose } from "@/features/access/domain/setup-link";
import type { SetupLinkRepository } from "@/features/access/domain/setup-link-repository";
import type { Clock } from "@/shared/application/clock";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import { findBoundCeremony, type BoundCeremonyDeps } from "./bound-ceremony";

export type ResumeSetupDeps = BoundCeremonyDeps & {
  readonly clock: Clock;
  readonly setupLinks: SetupLinkRepository;
};

// Where a setup stands: an invite waits for its name, everything else for its passkey
export type SetupProgress = {
  readonly purpose: SetupLinkPurpose;
  readonly next: "name" | "passkey";
};

// A setup page opened again - reloaded, or brought back after switching apps - has lost its link's token from the
// address bar; the ceremony cookie still says where it was
export async function resumeSetup(
  deps: ResumeSetupDeps,
  ceremonyCookie: string | undefined,
): Promise<Result<SetupProgress, Extract<AccessError, "setup_link_unusable">>> {
  const setup = await findBoundCeremony(deps, ceremonyCookie, "setup");
  if (
    setup === undefined ||
    Ceremonies.isExpired(setup, deps.clock()) ||
    setup.setupLinkId === undefined
  ) {
    return err("setup_link_unusable");
  }
  const link = await deps.setupLinks.get(setup.setupLinkId);
  if (link === undefined) {
    return err("setup_link_unusable");
  }

  return ok({ purpose: link.purpose, next: setup.accountId === undefined ? "name" : "passkey" });
}
