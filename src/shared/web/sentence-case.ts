// "mật khẩu dự phòng" as a title or the start of a sentence: "Mật khẩu dự phòng"
export function sentenceCase(text: string): string {
  return text.charAt(0).toLocaleUpperCase("vi") + text.slice(1);
}

// A title carried on after a name: "Tạo link khôi phục" becomes "Lan tạo link khôi phục". Only the first letter
// changes, so "Face ID" inside stays as it is.
export function midSentence(text: string): string {
  return text.charAt(0).toLocaleLowerCase("vi") + text.slice(1);
}
