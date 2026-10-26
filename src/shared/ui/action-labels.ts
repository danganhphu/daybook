// Words for actions that mean the same thing on every screen, so a button never says "Huỷ" in one place and
// "Bỏ qua" in another
export const actionLabels = {
  save: "Lưu",
  saving: "Đang lưu...",
  cancel: "Huỷ",
  confirm: "Xác nhận",
  add: "Thêm",
  done: "Xong",
  edit: "Sửa",
  remove: "Xoá",
  undo: "Hoàn tác",
  restore: "Khôi phục",
  back: "Quay lại",
  options: "Tuỳ chọn",
} as const;

// The accessible name of a row's menu, so a screen reader tells one row's from the next: "Tuỳ chọn cho Chrome"
export function optionsFor(subject: string): string {
  return `${actionLabels.options} cho ${subject}`;
}
