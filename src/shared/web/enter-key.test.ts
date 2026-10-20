import { describe, expect, it } from "vitest";

import { enterSends } from "./enter-key";

const enter = { key: "Enter", shiftKey: false, isComposing: false };

describe("enterSends", () => {
  it("given a desktop, when Enter is pressed, then it sends", () => {
    expect(enterSends(enter, "desktop")).toBe(true);
  });

  it("given a desktop, when Shift+Enter is pressed, then it is a new line", () => {
    expect(enterSends({ ...enter, shiftKey: true }, "desktop")).toBe(false);
  });

  it("given a phone, when Enter is pressed, then it is a new line and the button sends", () => {
    expect(enterSends(enter, "phone")).toBe(false);
  });

  it("given a Vietnamese input method still composing a letter, when Enter is pressed, then it does not send", () => {
    expect(enterSends({ ...enter, isComposing: true }, "desktop")).toBe(false);
  });

  it("given any other key, when pressed, then it does not send", () => {
    expect(enterSends({ ...enter, key: "a" }, "desktop")).toBe(false);
  });
});
