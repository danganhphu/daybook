import { describe, expect, it } from "vitest";

import { searchTermSchema, searchText } from "./search-text";

describe("searchText", () => {
  it.each([
    ["Giao 2 hộp thuốc tê", "giao 2 hop thuoc te"],
    ["Đặng Văn Hùng", "dang van hung"],
    ["  Nha   khoa\nMinh Tâm ", "nha khoa minh tam"],
    // Typed with a decomposed keyboard: the same letters, a different sequence of code points
    ["Tâm".normalize("NFD"), "tam"],
    ["ĐẠI LÝ", "dai ly"],
  ])("given %j, when made searchable, then it reads %j", (text, expected) => {
    expect(searchText(text)).toBe(expected);
  });
});

describe("searchTermSchema", () => {
  it("given what someone typed into the search box, when parsed, then it is matched the way the text was stored", () => {
    expect(searchTermSchema.parse(" Thuốc  TÊ ")).toBe("thuoc te");
  });

  it.each(["", "   ", "x".repeat(101)])("given %j, when parsed, then it is refused", (term) => {
    expect(searchTermSchema.safeParse(term).success).toBe(false);
  });
});
