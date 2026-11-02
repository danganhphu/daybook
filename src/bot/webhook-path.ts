// Where Telegram posts updates, registered by `pnpm telegram:setup`. A module of its own, so the Worker's entry can
// route on it without loading the bot.
export const webhookPath = "/telegram/webhook";
