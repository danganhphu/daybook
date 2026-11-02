import { z } from "zod";

// Only the fields of an Update the bot reads (Bot API: Update, Message, CallbackQuery, User, Chat). Everything else
// Telegram sends is dropped by the parse, so nothing unread reaches the handlers.

const userSchema = z.object({
  id: z.int(),
  is_bot: z.boolean(),
  first_name: z.string(),
  last_name: z.string().optional(),
});

const chatSchema = z.object({
  id: z.int(),
  type: z.string(),
});

const messageSchema = z.object({
  message_id: z.int(),
  chat: chatSchema,
  from: userSchema.optional(),
  text: z.string().optional(),
});

const callbackQuerySchema = z.object({
  id: z.string(),
  from: userSchema,
  // An inaccessible message still has its chat and id
  message: z.object({ message_id: z.int(), chat: chatSchema }).optional(),
  data: z.string().optional(),
});

export const updateSchema = z.object({
  update_id: z.int(),
  message: messageSchema.optional(),
  edited_message: messageSchema.optional(),
  callback_query: callbackQuerySchema.optional(),
});

export type TelegramUser = z.infer<typeof userSchema>;

export type TelegramMessage = z.infer<typeof messageSchema>;

export type TelegramCallbackQuery = z.infer<typeof callbackQuerySchema>;

// The update kinds the webhook subscribes to (setWebhook's allowed_updates), so Telegram sends no others
export const allowedUpdates = ["message", "edited_message", "callback_query"] as const;

// The bot talks to one person at a time, in their own chat with it
export function isPrivate(chat: { readonly type: string }): boolean {
  return chat.type === "private";
}
