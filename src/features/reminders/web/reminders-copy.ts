export const remindersCopy = {
  title: "Việc cần nhắc",
  add: "Thêm việc cần nhắc",
  fromNote: "Nhắc việc này",
  edit: "Sửa việc cần nhắc",
  text: "Việc cần nhắc",
  dueOn: "Ngày nhắc",
  today: "Hôm nay",
  tomorrow: "Ngày mai",
  overdue: "Quá hạn",
  customer: "Khách",
  customerOptional: "Không bắt buộc",
  customerUnknown: "Không có khách này. Thêm ở trang Khách hàng.",
  seeAll: "Xem tất cả việc cần nhắc",
  open: "Đang mở",
  done: "Đã xong",
  reopen: "Mở lại",
  reopened: "Đã mở lại",
  noneDone: "Chưa có việc nào xong",
  more: "Xem thêm",
  deleted: "Đã xoá việc cần nhắc",
  empty: "Chưa có việc nào cần nhắc",
  emptyHint: "Thêm ở đây, trên trang một khách, hoặc từ menu của một ghi chú.",
  noneForCustomer: "Chưa có việc nào cho khách này",
  refused: "Việc cần nhắc chưa đủ: cần nội dung và ngày.",
} as const;

export function overdueBy(days: number): string {
  return `Quá hạn ${days} ngày`;
}

export function markDone(text: string): string {
  return `Xong: ${text}`;
}

// Under a finished reminder: "Xong 26/10 (Lan)"
export function doneText(day: string, by: string): string {
  return `Xong ${day} (${by})`;
}

export function moreDue(count: number): string {
  return `và ${count} việc nữa`;
}
