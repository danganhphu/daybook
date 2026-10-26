import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { contentSecurityPolicyHeader, securityHeaders } from "./request-policy";

// STATIC_HEADERS exists only in tests: public/_headers as text, read by vitest.config.ts
const file = z.string().parse(Reflect.get(env, "STATIC_HEADERS"));

// Cloudflare's _headers format: a path on a line of its own, then indented "Name: value" lines
function rulesIn(text: string): ReadonlyMap<string, ReadonlyMap<string, string>> {
  const rules = new Map<string, Map<string, string>>();
  let current = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      continue;
    }
    if (!/^\s/.test(line)) {
      current = new Map();
      rules.set(line.trim(), current);
      continue;
    }
    const colon = line.indexOf(":");
    current.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }

  return rules;
}

const rules = rulesIn(file);

describe("public/_headers", () => {
  it("given every static file, when its headers are compared with the proxy's, then each one both set says the same", () => {
    const proxied = securityHeaders("unused", true);
    const shared = [...(rules.get("/*") ?? [])].filter(
      ([name]) => name !== contentSecurityPolicyHeader,
    );

    expect(shared.map(([name]) => name)).toEqual(
      expect.arrayContaining(["strict-transport-security", "x-content-type-options"]),
    );
    expect(Object.fromEntries(shared)).toEqual(
      Object.fromEntries(shared.map(([name]) => [name, proxied[name]])),
    );
  });

  it("given a static file opened on its own, when its policy is read, then it can run nothing and be framed by nothing", () => {
    const policy = rules.get("/*")?.get(contentSecurityPolicyHeader);

    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("sandbox");
  });

  it("given the build's hashed files, when their cache is read, then they are kept for good, as vinext would have set", () => {
    expect(rules.get("/_next/static/*")?.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });
});
