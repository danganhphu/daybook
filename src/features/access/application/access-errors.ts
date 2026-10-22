// Every way an access use case is known to fail. A closed set: adapters branch on the code, and the compiler refuses a
// code without a message below. Faults - a database that is down, a bug - are not here; they throw.
export type AccessError =
  | "unauthenticated"
  | "setup_link_unusable"
  | "step_up_required"
  | "passkey_not_accepted"
  | "rate_limited";

// Phrased for the person signing in, the same in every adapter. None says why a link, a session or a passkey failed,
// so none helps someone probing them; the reason goes to the access log instead.
export const accessErrorMessages = {
  unauthenticated: "Phiên đăng nhập đã hết. Đăng nhập lại để tiếp tục.",
  setup_link_unusable: "Link này không dùng được nữa. Nhờ người đã gửi link tạo link mới.",
  step_up_required: "Xác nhận lại bằng Face ID, vân tay hoặc mật khẩu để tiếp tục.",
  passkey_not_accepted: "Không xác nhận được bằng khoá đăng nhập này. Thử lại nhé.",
  rate_limited: "Thử nhiều lần quá. Đợi vài phút rồi thử lại.",
} as const satisfies Record<AccessError, string>;
