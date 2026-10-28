import { accessCopy } from "@/features/access/web/access-copy";
import { customersCopy } from "@/features/customers/web/customers-copy";
import { notificationsCopy } from "@/features/notifications/web/notifications-copy";
import { reportsCopy } from "@/features/reports/web/reports-copy";
import { recentlyDeletedCopy } from "@/shared/web/recently-deleted";

// Each section's name is both its row in Settings and the title of the screen it opens
export const settingsCopy = {
  account: "Tên và tên đăng nhập",
  notifications: notificationsCopy.title,
  signInMethods: "Cách đăng nhập",
  devices: "Thiết bị đang đăng nhập",
  activity: "Hoạt động gần đây",
  people: "Người dùng",
  kinds: customersCopy.kinds.title,
  quiet: reportsCopy.quiet,
  deleted: recentlyDeletedCopy.title,
  groups: { account: accessCopy.account, signIn: accessCopy.signIn, book: "Sổ chung" },
} as const;
