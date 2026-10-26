import { afterEach, describe, expect, it, vi } from "vitest";

import { onRequestError } from "./instrumentation";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("onRequestError", () => {
  it("given a failed query wrapping D1's error, when it is logged, then the line has the route, the digest and both errors' first lines, and no parameter", () => {
    const written = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d1 = new Error(
      "D1_ERROR: UNIQUE constraint failed: product.search_name: SQLITE_CONSTRAINT",
    );
    const failed = Object.assign(
      new Error(
        'Failed query: insert into "product" values (?, ?)\nparams: Nha khoa Hướng Dương,gel tê',
        {
          cause: d1,
        },
      ),
      { digest: "2741837510" },
    );

    onRequestError(
      failed,
      { method: "POST" },
      { routePath: "/customers/[id]", routeType: "action" },
    );

    expect(written).toHaveBeenCalledOnce();
    const line = String(written.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toEqual({
      event: "request_failed",
      route: "/customers/[id]",
      during: "action",
      method: "POST",
      digest: "2741837510",
      errors: [
        { name: "Error", message: 'Failed query: insert into "product" values (?, ?)' },
        {
          name: "Error",
          message: "D1_ERROR: UNIQUE constraint failed: product.search_name: SQLITE_CONSTRAINT",
        },
      ],
    });
    expect(line).not.toContain("Hướng Dương");
  });
});
