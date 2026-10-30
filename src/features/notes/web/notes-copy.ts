import { notesSearchLimit } from "@/features/notes/application/search-notes";

// What the note screens say, in one place, so a label and the test that looks for it cannot drift apart
export const notesCopy = {
  deleted: "Đã xoá ghi chú",
  // One of them, mid-sentence: "Xoá ghi chú này?"
  one: "ghi chú",
  emptyToday: "Hôm nay chưa có ghi chú nào",
  emptyTodayHint: "Gõ vào ô bên dưới, ghi chú sẽ hiện ở đây.",
  emptyDay: "Ngày này không có ghi chú nào",
  otherDays: "Chuyển ngày",
  // Followed by the day: "Xem Thứ Năm, 22/10"
  goToDay: "Xem",
  // The next-day button on today, disabled: its name says why
  noNextDay: "Ngày mai chưa tới",
  pickDay: "Chọn ngày",
  search: "Tìm ghi chú",
  searchPrompt: "Tìm trong mọi ghi chú",
  searchHint: "Gõ tên khách, sản phẩm hay chữ bất kỳ. Gõ không dấu cũng được.",
  notFound: "Không tìm thấy ghi chú nào",
  notFoundHint: "Thử gõ ít chữ hơn.",
  moreFound: `Chỉ hiện ${notesSearchLimit} ghi chú gần nhất. Gõ thêm chữ để tìm trúng hơn.`,
} as const;
