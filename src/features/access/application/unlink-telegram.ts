import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { Session } from "@/features/access/domain/session";
import type { TelegramLinkRepository } from "@/features/access/domain/telegram-link-repository";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { err, ok, type Result } from "@/shared/domain/result";

import type { AccessError } from "./access-errors";
import type { AccessEventWrites, TelegramLinkWrites } from "./access-writes";
import { enlistTelegramUnlink } from "./enlist-telegram-unlink";
import { isSteppedUp, type StepUpDeps } from "./step-up";

export type UnlinkTelegramDeps = StepUpDeps & {
  readonly telegramLinks: TelegramLinkRepository;
  readonly startUnitOfWork: () => UnitOfWork<{
    readonly telegramLinks: TelegramLinkWrites;
    readonly accessEvents: AccessEventWrites;
  }>;
};

// The bot stops taking this account's Telegram user; their messages are a stranger's from now on
export async function unlinkTelegram(
  deps: UnlinkTelegramDeps,
  session: Session,
  origin: RequestOrigin,
): Promise<Result<null, Extract<AccessError, "step_up_required" | "not_found">>> {
  if (!(await isSteppedUp(deps, session))) {
    return err("step_up_required");
  }
  const link = await deps.telegramLinks.get(session.accountId);
  if (link === undefined) {
    return err("not_found");
  }

  const work = deps.startUnitOfWork();
  enlistTelegramUnlink(
    work,
    link,
    { actorId: session.accountId, sessionId: session.id },
    origin,
    deps.clock(),
  );
  await work.commit();

  return ok(null);
}
