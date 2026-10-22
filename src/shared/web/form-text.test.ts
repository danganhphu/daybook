import { describe, expect, it } from "vitest";

import { formText } from "./form-text";

describe("formText", () => {
  it("given a text field, when read, then its value comes back as typed", () => {
    const form = new FormData();
    form.set("username", " lan ");

    expect(formText(form, "username")).toBe(" lan ");
  });

  it("given a missing field or a file, when read, then it is empty text", () => {
    const form = new FormData();
    form.set("upload", new File(["x"], "x.txt"));

    expect(formText(form, "username")).toBe("");
    expect(formText(form, "upload")).toBe("");
  });
});
