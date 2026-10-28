import type { NotificationError } from "@/features/notifications/application/notification-errors";

export const notificationsCopy = {
  title: "Thông báo",
  thisDevice: "Thiết bị này",
  on: "Đang bật",
  off: "Đang tắt",
  turnOn: "Bật",
  turnOff: "Tắt",
  unsupported: "Trình duyệt này không nhận được thông báo.",
  blocked: "Bạn đã chặn thông báo. Hãy cho phép trong cài đặt trang web của Chrome.",
  unavailable: "Bản này chưa gửi được thông báo.",
  turnedOn: "Đã bật thông báo",
  turnedOff: "Đã tắt thông báo",
  notTurnedOn: "Chưa bật được thông báo. Hãy thử lại.",
  times: "Giờ nhắc",
  morning: "Nhắc việc buổi sáng",
  weekly: "Tổng kết thứ Sáu",
  timeOff: "Tắt",
  timesSaved: "Đã lưu giờ nhắc",
  invalidTimes: "Giờ nhắc không hợp lệ.",
  devices: "Thiết bị nhận thông báo",
  lastSent: "Gửi lần cuối",
  neverSent: "Chưa gửi lần nào",
  remove: "Gỡ",
  removed: "Đã gỡ",
  securityAlwaysOn: "Thay đổi về đăng nhập luôn được báo.",
  noDevice: "Chưa bật",
  offer: "Bật thông báo để sáng nào cũng được nhắc việc?",
  later: "Để sau",
} as const;

export function devicesOn(count: number): string {
  return count === 0 ? notificationsCopy.noDevice : `Đang bật trên ${count} thiết bị`;
}

export const notificationErrorMessages = {
  push_unavailable: notificationsCopy.unavailable,
  push_service_unknown: "Trình duyệt này chưa được hỗ trợ.",
  not_found: "Không tìm thấy thiết bị này.",
  times_changed_elsewhere: "Giờ nhắc vừa được đổi ở nơi khác. Hãy xem lại.",
} as const satisfies Record<NotificationError, string>;
