import { accessCopy } from "@/features/access/web/access-copy";
import { customersCopy } from "@/features/customers/web/customers-copy";
import { notificationsCopy } from "@/features/notifications/web/notifications-copy";
import { recentlyDeletedCopy } from "@/shared/web/recently-deleted";

// Each section's name is both its row in Settings and the title of the screen it opens
export const settingsCopy = {
  account: "Tên và tên đăng nhập",
  notifications: notificationsCopy.title,
  signInMethods: "Cách đăng nhập",
  devices: "Thiết bị đang đăng nhập",
  activity: "Lịch sử đăng nhập",
  people: "Người dùng",
  kinds: customersCopy.kinds.title,
  deleted: recentlyDeletedCopy.title,
  telegram: "Telegram",
  groups: { account: accessCopy.account, signIn: accessCopy.signIn, book: "Sổ chung" },
  telegramNotLinked: "Chưa kết nối",
  telegramConnect: "Kết nối",
  telegramOpen: "Mở Telegram",
  telegramUse: "Nhắn vào bot như ghi chú: đơn và việc cần nhắc tự vào sổ.",
  telegramDisconnect: "Ngắt kết nối",
  telegramDisconnectQuestion: "Ngắt kết nối Telegram?",
  telegramDisconnectMeans: "Tin nhắn từ Telegram này sẽ không vào sổ nữa.",
  telegramDisconnected: "Đã ngắt kết nối Telegram",
  telegramUnreachable: "Chưa liên lạc được với Telegram. Hãy thử lại.",
} as const;

// "Đã kết nối: Lan Nguyễn", under the Telegram row
export function telegramLinkedAs(name: string): string {
  return `Đã kết nối: ${name}`;
}

// Under Mở Telegram, while the link lasts
export function telegramOpenHint(minutes: number): string {
  return `Mở Telegram rồi bấm Bắt đầu (Start). Link dùng được ${minutes} phút.`;
}

// "Kết nối lúc 09:30 30/10"
export function telegramLinkedSince(moment: string): string {
  return `Kết nối lúc ${moment}`;
}
