import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("test runtime", () => {
  it("runs in workerd with the D1 binding", async () => {
    const row = await env.DB.prepare("select 1 as one").first<{ one: number }>();

    expect(row).toEqual({ one: 1 });
  });
});
