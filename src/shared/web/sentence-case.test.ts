import { describe, expect, it } from "vitest";

import { midSentence, sentenceCase } from "./sentence-case";

describe("sentenceCase", () => {
  it.each([
    ["mật khẩu dự phòng", "Mật khẩu dự phòng"],
    ["đăng nhập", "Đăng nhập"],
    ["Face ID", "Face ID"],
    ["", ""],
  ])("given %j, when made a title, then it reads %j", (text, expected) => {
    expect(sentenceCase(text)).toBe(expected);
  });
});

describe("midSentence", () => {
  it.each([
    ["Tạo link khôi phục", "tạo link khôi phục"],
    ["Đăng xuất", "đăng xuất"],
    ["Thêm Face ID hoặc vân tay", "thêm Face ID hoặc vân tay"],
    ["", ""],
  ])("given %j, when carried on after a name, then it reads %j", (text, expected) => {
    expect(midSentence(text)).toBe(expected);
  });
});
