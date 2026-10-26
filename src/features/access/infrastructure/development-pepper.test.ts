import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { developmentPepper, pepperFitsOrigin } from "./development-pepper";

describe("developmentPepper", () => {
  it("given the pepper cloudflare.config.ts gives dev, when compared, then it is the one the Worker knows to refuse", () => {
    // Passed by vitest.config.ts, which reads the config in Node
    expect(Reflect.get(env, "CONFIG_DEVELOPMENT_PEPPER")).toBe(developmentPepper);
  });
});

const realPepper = "c2VjcmV0LXBlcHBlci1mb3ItdGhlLWRlcGxveS0wMDE";

describe("pepperFitsOrigin", () => {
  it.each([
    {
      which: "the development pepper on localhost",
      pepper: developmentPepper,
      appOrigin: "http://localhost:5173",
      fits: true,
    },
    {
      which: "the development pepper in the end-to-end build",
      pepper: developmentPepper,
      appOrigin: "https://localhost:5180",
      fits: true,
    },
    {
      which: "the development pepper on the deployed app",
      pepper: developmentPepper,
      appOrigin: "https://daybook.example.workers.dev",
      fits: false,
    },
    {
      which: "a real pepper on the deployed app",
      pepper: realPepper,
      appOrigin: "https://daybook.example.workers.dev",
      fits: true,
    },
  ])("given $which, when checked, then it fits: $fits", ({ pepper, appOrigin, fits }) => {
    expect(pepperFitsOrigin(pepper, appOrigin)).toBe(fits);
  });
});
