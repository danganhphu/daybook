// What only the bot says. Buttons and sentences that mean the same as the web's come from the web's copy.
export const botCopy = {
  saved: "Đã lưu.",
  openOrder: "Mở đơn",
  open: "Mở",
  openWeb: "Mở web",
  openSettings: "Mở Cài đặt",
  openReports: "Xem báo cáo",
  markedDone: "Đã xong việc này.",
  // An edit in Telegram cannot reach the note, which keeps the words as first sent
  edited: "Sửa ở đây không đổi được ghi chú. Mở web để sửa.",
  notText: "Hiện mới ghi được tin chữ.",
  // To someone not linked, on /start only; anything else from them gets no answer
  stranger: "Bot này chỉ dành cho người có tài khoản. Mở Cài đặt trong app để kết nối Telegram.",
  examples: [
    "Hướng Dương 2 hộp thuốc tê 500k",
    "Thứ 5 gọi lại nha khoa Hoa Mai",
    "Chị Lan hỏi giá găng tay",
  ],
  unknownCommand: "Không có lệnh này. Gõ /help để xem cách dùng.",
  // In the bell, when every try to answer a message failed
  unansweredTitle: "Bot chưa trả lời được một tin nhắn",
  unansweredBody: "Tin nhắn vẫn được ghi vào sổ. Mở để xem ngày đó.",
  nothingToday: "Hôm nay chưa có đơn nào, cũng không có việc cần nhắc.",
  noReminders: "Không có việc nào cần nhắc.",
} as const;

export function linkedTo(displayName: string): string {
  return `Đã kết nối với tài khoản ${displayName}. Từ giờ cứ nhắn vào đây.`;
}

// /start and /help: what to send, by example
export function howTo(): string {
  return [
    "Cứ nhắn như ghi chú, mỗi tin một việc. Ví dụ:",
    ...botCopy.examples.map((example) => `- ${example}`),
    "",
    "Đơn và việc cần nhắc tự ghi vào sổ. Sửa thì mở web.",
  ].join("\n");
}

// "Đơn thứ 12 tháng này, tổng 8.450.000đ"
export function orderOfMonth(count: number, total: string): string {
  return `Đơn thứ ${count} tháng này, tổng ${total}`;
}
