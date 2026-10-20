import { describe, expect, it } from "vitest";

import { err, ok } from "@/shared/domain/result";

import { attempt, faultMessage } from "./attempt";

describe("attempt", () => {
  it("given a call that succeeds, when attempted, then its result comes back as it is", async () => {
    expect(await attempt(() => Promise.resolve(ok("saved")))).toEqual(ok("saved"));
  });

  it("given a refusal from the server, when attempted, then her sentence comes back as it is", async () => {
    expect(await attempt(() => Promise.resolve(err("Chưa có nội dung")))).toEqual(
      err("Chưa có nội dung"),
    );
  });

  it("given a call that throws, as it does with no connection, when attempted, then she gets one plain sentence", async () => {
    expect(await attempt(() => Promise.reject(new TypeError("Failed to fetch")))).toEqual(
      err(faultMessage),
    );
  });
});
