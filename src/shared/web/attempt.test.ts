import { redirect } from "next/navigation";
import { describe, expect, it } from "vitest";

import { err, ok } from "@/shared/domain/result";
import { routes } from "@/shared/web/routes";

import { attempt, faultMessage } from "./attempt";

describe("attempt", () => {
  it("given a call that succeeds, when attempted, then its result comes back as it is", async () => {
    expect(await attempt(() => Promise.resolve(ok("saved")))).toEqual(ok("saved"));
  });

  it("given a refusal from the server, when attempted, then its sentence comes back as it is", async () => {
    expect(await attempt(() => Promise.resolve(err("Chưa có nội dung")))).toEqual(
      err("Chưa có nội dung"),
    );
  });

  it("given a call that throws, as it does with no connection, when attempted, then the user gets one plain sentence", async () => {
    expect(await attempt(() => Promise.reject(new TypeError("Failed to fetch")))).toEqual(
      err(faultMessage),
    );
  });

  it("given a redirect to sign in, as when the session has ended, when attempted, then it goes on to the framework", async () => {
    let redirected: unknown;
    try {
      redirect(routes.signIn);
    } catch (error) {
      redirected = error;
    }

    await expect(attempt(() => Promise.reject(redirected))).rejects.toBe(redirected);
  });
});
