// The bot's commands, read by the router and registered with setMyCommands by `pnpm telegram:setup`: English names,
// Vietnamese descriptions (Bot API, BotCommand: a name of 1-32 lowercase letters, digits and underscores). Telegram
// lists them in this order when "/" is typed: the daily ones first, /start last, as it is used once.
export const botCommands = [
  { command: "today", description: "Đơn và việc cần nhắc hôm nay" },
  { command: "reminders", description: "Việc cần nhắc chưa xong" },
  { command: "week", description: "Tổng kết tuần này: đơn, doanh số, tiền thu, còn nợ" },
  { command: "month", description: "Tổng kết tháng này: đơn, doanh số, tiền thu, còn nợ" },
  { command: "web", description: "Mở app trên web" },
  { command: "settings", description: "Mở cài đặt: giờ nhắc, thông báo, tài khoản" },
  { command: "help", description: "Cách nhắn để ghi đơn và việc cần nhắc" },
  { command: "start", description: "Kết nối Telegram với tài khoản" },
] as const;

export type BotCommandName = (typeof botCommands)[number]["command"];

export type CommandCall = {
  readonly name: BotCommandName | undefined;
  // What follows the command: the link code after /start
  readonly argument: string;
};

const names: ReadonlySet<string> = new Set(botCommands.map((each) => each.command));

export function descriptionOf(name: BotCommandName): string {
  return botCommands.find((each) => each.command === name)?.description ?? name;
}

function isCommandName(name: string): name is BotCommandName {
  return names.has(name);
}

// "/start abc" or "/today@daybook_bot", as Telegram's clients send a command; undefined for any other text, which is a
// note. An unknown command has no name.
export function commandIn(text: string): CommandCall | undefined {
  const matched = /^\/([A-Za-z0-9_]{1,32})(?:@\w+)?(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (matched === null) {
    return undefined;
  }
  const name = (matched[1] ?? "").toLowerCase();

  return { name: isCommandName(name) ? name : undefined, argument: (matched[2] ?? "").trim() };
}
