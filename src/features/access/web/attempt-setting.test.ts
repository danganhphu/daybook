import { describe, expect, it } from "vitest";

import { accessErrorMessages } from "@/features/access/application/access-errors";
import { err, ok } from "@/shared/domain/result";
import { faultMessage } from "@/shared/web/attempt";

import { attemptSetting, problemMessage } from "./attempt-setting";

describe("attemptSetting", () => {
  it("given a refusal, when attempted, then its code survives, so the page can tell step-up from the rest", async () => {
    const refusal = err({
      code: "step_up_required" as const,
      message: accessErrorMessages.step_up_required,
    });

    expect(await attemptSetting(() => Promise.resolve(refusal))).toEqual(refusal);
    expect(await attemptSetting(() => Promise.resolve(ok(null)))).toEqual(ok(null));
  });

  it("given a call that throws, as it does with no connection, when attempted, then it is a fault with one plain sentence", async () => {
    expect(await attemptSetting(() => Promise.reject(new TypeError("Failed to fetch")))).toEqual(
      err({ code: "fault", message: faultMessage }),
    );
  });
});

describe("problemMessage", () => {
  it("given a closed step-up, when shown, then there is nothing to say", () => {
    expect(problemMessage({ code: "cancelled", message: "Đã huỷ." })).toBeUndefined();
  });

  it("given any other refusal, when shown, then its sentence is", () => {
    expect(problemMessage({ code: "last_way_in", message: accessErrorMessages.last_way_in })).toBe(
      accessErrorMessages.last_way_in,
    );
  });
});
