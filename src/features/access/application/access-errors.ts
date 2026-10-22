// Every way an access use case is known to fail. A closed set: adapters branch on the code, and the compiler refuses a
// code without a message below. Faults - a database that is down, a bug - are not here; they throw.
export type AccessError =
  | "unauthenticated"
  | "setup_link_unusable"
  | "step_up_required"
  | "passkey_not_accepted"
  | "password_not_accepted"
  | "password_not_saved"
  | "username_taken"
  | "last_way_in"
  | "not_found"
  | "rate_limited";

// Phrased for the person signing in, the same in every adapter. None says why a link, a session or a passkey failed,
// so none helps someone probing them; the reason goes to the access log instead.
export const accessErrorMessages = {
  unauthenticated: "Phiên đăng nhập đã hết. Hãy đăng nhập lại.",
  setup_link_unusable: "Link này không còn dùng được. Hãy xin link mới.",
  // With a passkey or the password, whichever the account has
  step_up_required: "Hãy xác nhận lại để tiếp tục.",
  passkey_not_accepted: "Không xác nhận được. Hãy thử lại.",
  // The same for a wrong password, an unknown username and a locked password (OWASP Authentication cheat sheet)
  password_not_accepted: "Sai tên đăng nhập hoặc mật khẩu.",
  password_not_saved: "Không lưu được mật khẩu. Hãy thử lại.",
  username_taken: "Tên đăng nhập này đã có người dùng.",
  last_way_in: "Không thể xoá vì đây là cách đăng nhập duy nhất. Bạn có muốn thêm cách khác không?",
  not_found: "Không tìm thấy mục này.",
  rate_limited: "Bạn đã thử quá nhiều lần. Hãy đợi vài phút rồi thử lại.",
} as const satisfies Record<AccessError, string>;
