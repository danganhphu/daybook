import { backupPasswordTerm, passkeyTerm } from "@/features/access/application/access-terms";
import { sentenceCase } from "@/shared/web/sentence-case";

// Words the access screens share, between a page's metadata and its screen, between screens, or between an action and
// the activity line it leaves
export const accessCopy = {
  signIn: "Đăng nhập",
  signOut: "Đăng xuất",
  signOutOthers: "Đăng xuất các thiết bị khác",
  signOutEverywhere: "Đăng xuất mọi thiết bị",
  settings: "Cài đặt",
  account: "Tài khoản",
  displayName: "Tên",
  username: "Tên đăng nhập",
  password: "Mật khẩu",
  changeDisplayName: "Đổi tên",
  changeUsername: "Đổi tên đăng nhập",
  setUpPasskey: `Bật ${passkeyTerm}`,
  withPasskey: `Dùng ${passkeyTerm}`,
  addPasskey: `Thêm ${passkeyTerm}`,
  removePasskey: `Xoá ${passkeyTerm}`,
  setBackupPassword: `Đặt ${backupPasswordTerm}`,
  backupPasswordPurpose: `${sentenceCase(backupPasswordTerm)} dùng khi máy không có ${passkeyTerm}.`,
  thisDevice: "Thiết bị này",
} as const;
