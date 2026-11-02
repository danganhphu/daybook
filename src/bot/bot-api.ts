import type { BotCommand, Opts } from "@grammyjs/types";

import type { Result } from "@/shared/domain/result";

// Why a call to the Bot API did not do what was asked
export type BotFailure =
  // Telegram is busy or unreachable: try again, after its own wait when it gives one (error 429's retry_after)
  | { readonly kind: "retry"; readonly afterSeconds: number | undefined }
  // The person blocked the bot or deleted the chat (403): nothing will reach them until they write again
  | { readonly kind: "blocked" }
  // Telegram refused the request itself; sending it again changes nothing
  | { readonly kind: "refused"; readonly code: number; readonly description: string };

export type BotCall<T> = Promise<Result<T, BotFailure>>;

// The methods the bot uses, with Telegram's own parameter names; files are never sent
type Params<M extends keyof Opts<never>> = Opts<never>[M];

// The Bot API as a port: the Worker brings a client over fetch, tests a recording fake (ADR 0013, decision 8)
export type BotApi = {
  getMe(): BotCall<{ readonly username: string }>;
  sendMessage(params: Params<"sendMessage">): BotCall<{ readonly messageId: number }>;
  editMessageText(params: Params<"editMessageText">): BotCall<null>;
  answerCallbackQuery(params: Params<"answerCallbackQuery">): BotCall<null>;
  // The operator's setup only
  setWebhook(params: Params<"setWebhook">): BotCall<null>;
  setMyCommands(params: { readonly commands: ReadonlyArray<BotCommand> }): BotCall<null>;
  setMyDescription(params: Params<"setMyDescription">): BotCall<null>;
  setMyShortDescription(params: Params<"setMyShortDescription">): BotCall<null>;
};
