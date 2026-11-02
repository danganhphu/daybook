// Telegram's deep link: opens the bot in the Telegram app, and its Start sends "/start <code>" (Bot API, "Deep
// linking")
const telegramLinkOrigin = "https://t.me";

export function telegramStartUrl(botUsername: string, code: string): string {
  const url = new URL(`/${botUsername}`, telegramLinkOrigin);
  url.searchParams.set("start", code);

  return url.toString();
}
