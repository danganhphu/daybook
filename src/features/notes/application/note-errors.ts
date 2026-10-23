// Every way a note use case is known to fail. A closed set: adapters branch on the code, and the compiler refuses a
// code without a message below. Faults - a database that is down, a bug - are not here; they throw.
export type NoteError =
  | "note_not_found"
  | "note_deleted"
  | "note_not_deleted"
  | "note_changed_elsewhere";

// Phrased for the user, the same in every adapter
export const noteErrorMessages = {
  note_not_found: "Không tìm thấy ghi chú này nữa.",
  note_deleted: "Ghi chú này đã bị xoá, không sửa được.",
  note_not_deleted: "Ghi chú này vẫn còn, không cần khôi phục.",
  // Two people share the book: the other one saved first, from another phone
  note_changed_elsewhere: "Ghi chú này vừa được sửa ở máy khác. Xem bản mới rồi thử lại.",
} as const satisfies Record<NoteError, string>;
