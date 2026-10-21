import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { SecretToken } from "@/features/access/domain/secret";
import * as SetupLinks from "@/features/access/domain/setup-link";
import type { PendingSetupLink, SetupLinkGrant } from "@/features/access/domain/setup-link";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

import type { AccessEventWrites, SetupLinkWrites } from "./access-writes";
import { hashSecretToken, newSecretToken } from "./secret-tokens";
import type { Secrets } from "./secrets";

export type IssueSetupLinkDeps = {
  readonly clock: Clock;
  readonly secrets: Secrets;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly setupLinks: SetupLinkWrites;
    readonly accessEvents: AccessEventWrites;
  }>;
};

export type IssuedSetupLink = {
  readonly link: PendingSetupLink;
  // For the URL's fragment, handed out once; only its hash is stored
  readonly token: SecretToken;
};

export async function issueSetupLink(
  deps: IssueSetupLinkDeps,
  grant: SetupLinkGrant,
  origin: RequestOrigin,
): Promise<IssuedSetupLink> {
  const token = newSecretToken(deps.secrets);
  const link = SetupLinks.issue(
    { ...grant, tokenHash: await hashSecretToken(deps.secrets, token) },
    deps.clock(),
  );

  const work = deps.startUnitOfWork();
  work.setupLinks.add(link);
  work.accessEvents.add(
    AccessEvents.record(
      "setup_link_issued",
      { accountId: link.accountId, actorId: link.createdBy, detail: { purpose: link.purpose } },
      origin,
      link.createdAt,
    ),
  );
  await work.commit();

  return { link, token };
}
