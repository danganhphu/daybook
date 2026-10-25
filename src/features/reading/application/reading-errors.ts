// Every way reading a note or answering it is known to fail. A model that cannot read a message is not here: that is
// a reading of its own, kept and shown on the note.
export type ReadingError =
  | "note_unavailable"
  | "reader_unavailable"
  | "already_read"
  | "not_asked"
  | "customer_unavailable"
  | "customer_unnamed";

// Phrased for the user, the same in every adapter
export const readingErrorMessages = {
  note_unavailable: "Không tìm thấy ghi chú này nữa.",
  reader_unavailable: "Lúc này chưa đọc tin được.",
  // Two people share the book: the other one got there first
  already_read: "Tin này đã được đọc rồi.",
  not_asked: "Tin này đã được trả lời rồi.",
  customer_unavailable: "Khách này không còn trong danh sách.",
  customer_unnamed: "Tin không ghi tên khách để thêm.",
} as const satisfies Record<ReadingError, string>;
