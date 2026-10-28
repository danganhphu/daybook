import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { vapidPairFrom } from "./vapid-config";
import {
  developmentVapidKeys,
  newVapidKeys,
  vapidKeysFitOrigin,
  vapidPrivateKeySchema,
  vapidPublicKeySchema,
} from "./vapid-keys";

describe("developmentVapidKeys", () => {
  it("given the pair cloudflare.config.ts gives dev, when compared, then it is the one the Worker knows to refuse", () => {
    // Passed by vitest.config.ts, which reads the config in Node
    expect(Reflect.get(env, "CONFIG_DEVELOPMENT_VAPID_PUBLIC_KEY")).toBe(
      developmentVapidKeys.publicKey,
    );
    expect(Reflect.get(env, "CONFIG_DEVELOPMENT_VAPID_PRIVATE_KEY")).toBe(
      developmentVapidKeys.privateKey,
    );
  });
});

describe("vapidKeysFitOrigin", () => {
  it.each([
    {
      which: "the development pair on localhost",
      key: developmentVapidKeys.publicKey,
      origin: "http://localhost:5173",
      fits: true,
    },
    {
      which: "the development pair deployed",
      key: developmentVapidKeys.publicKey,
      origin: "https://daybook.example.workers.dev",
      fits: false,
    },
    {
      which: "another pair deployed",
      key: `B${"x".repeat(86)}`,
      origin: "https://daybook.example.workers.dev",
      fits: true,
    },
  ])("given $which, when checked, then it fits: $fits", ({ key, origin, fits }) => {
    expect(vapidKeysFitOrigin(key, origin)).toBe(fits);
  });
});

describe("vapidPairFrom", () => {
  const deployed = "https://daybook.example.workers.dev";

  it("given no keys, when read, then push is off", () => {
    expect(vapidPairFrom({}, deployed)).toBeUndefined();
  });

  it("given one half only, when read, then it fails loudly", () => {
    expect(() =>
      vapidPairFrom({ VAPID_PUBLIC_KEY: developmentVapidKeys.publicKey }, "http://localhost:5173"),
    ).toThrow(/together/);
  });

  it("given the development pair on a real origin, when read, then it fails loudly", () => {
    expect(() =>
      vapidPairFrom(
        {
          VAPID_PUBLIC_KEY: developmentVapidKeys.publicKey,
          VAPID_PRIVATE_KEY: developmentVapidKeys.privateKey,
        },
        deployed,
      ),
    ).toThrow(/development pair/);
  });
});

describe("newVapidKeys", () => {
  it("given new pairs, when read, then each half has its length and no two are alike", async () => {
    const keys = await newVapidKeys();

    expect(vapidPublicKeySchema.safeParse(keys.publicKey).success).toBe(true);
    expect(vapidPrivateKeySchema.safeParse(keys.privateKey).success).toBe(true);
    expect(keys.publicKey).not.toBe((await newVapidKeys()).publicKey);
  });
});
