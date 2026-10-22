import { argon2id } from "@noble/hashes/argon2.js";
import { describe, expect, it } from "vitest";

import { encodeBase64Url } from "@/shared/domain/base64url";

import {
  checkPasswordLength,
  deriveKey,
  isBreached,
  normalizePassword,
  passwordMessages,
} from "./browser-password";

// Far below the real cost, so the tests stay quick; the cost itself is the server's to choose
const cheap = { memoryKib: 64, iterations: 1, parallelism: 1 };
const salt = encodeBase64Url(new Uint8Array(16).fill(2));

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("Argon2id", () => {
  // RFC 9106, 5.3: the library the browser runs must give the standard's answer
  it("given the RFC 9106 test vector, when hashed, then the tag is the one the RFC gives", () => {
    const tag = argon2id(new Uint8Array(32).fill(1), new Uint8Array(16).fill(2), {
      t: 3,
      m: 32,
      p: 4,
      dkLen: 32,
      key: new Uint8Array(8).fill(3),
      personalization: new Uint8Array(12).fill(4),
    });

    expect(hex(tag)).toBe("0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659");
  });
});

describe("deriveKey", () => {
  it("given a Vietnamese password typed composed and decomposed, when derived, then the keys are the same", async () => {
    const composed = "mật khẩu của tôi rất dài".normalize("NFC");
    const decomposed = composed.normalize("NFD");

    expect(decomposed).not.toBe(composed);
    expect(await deriveKey(normalizePassword(decomposed), salt, cheap)).toBe(
      await deriveKey(normalizePassword(composed), salt, cheap),
    );
  });

  it("given another salt, when derived, then the key differs", async () => {
    const other = encodeBase64Url(new Uint8Array(16).fill(3));

    expect(await deriveKey("same password here", salt, cheap)).not.toBe(
      await deriveKey("same password here", other, cheap),
    );
  });

  it("given a password, when derived, then the key is 32 bytes of base64url", async () => {
    expect(await deriveKey("a password long enough", salt, cheap)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("checkPasswordLength", () => {
  it.each([
    ["fourteen characters", "a".repeat(14), passwordMessages.tooShort],
    ["129 characters", "a".repeat(129), passwordMessages.tooLong],
  ])("given %s, when checked, then it is refused", (_, password, message) => {
    expect(checkPasswordLength(password)).toEqual({ ok: false, error: message });
  });

  it.each([
    ["fifteen plain letters", "a".repeat(15)],
    [
      "fifteen Vietnamese letters, each one character after NFKC",
      normalizePassword("ệ".normalize("NFD").repeat(15)),
    ],
    ["fifteen emoji, each one character though two UTF-16 units", "🐱".repeat(15)],
  ])("given %s, when checked, then it is long enough", (_, password) => {
    expect(checkPasswordLength(password)).toEqual({ ok: true, value: password });
  });

  it("given fourteen emoji, when checked, then it is still too short", () => {
    expect(checkPasswordLength("🐱".repeat(14))).toEqual({
      ok: false,
      error: passwordMessages.tooShort,
    });
  });
});

// SHA-1 of "password", upper-case hex: 5BAA6 1E4C9B93F3F0682250B6CF8331B7EE68FD8
const prefix = "5BAA6";
const suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

// A stand-in for fetch that answers with this body and remembers what was asked
function answering(body: string, status = 200) {
  const asked: Array<{ url: string; padding: string | null }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    asked.push({
      url: input instanceof Request ? input.url : input.toString(),
      padding: new Headers(init?.headers).get("Add-Padding"),
    });
    return new Response(body, { status });
  };

  return { asked, fetcher };
}

describe("isBreached", () => {
  it("given a password in the list, when checked, then it is breached and only the prefix left the device", async () => {
    const { asked, fetcher } = answering(
      `0000000000000000000000000000000000A:0\n${suffix}:3861493`,
    );

    expect(await isBreached("password", fetcher)).toBe(true);
    expect(asked).toEqual([
      { url: `https://api.pwnedpasswords.com/range/${prefix}`, padding: "true" },
    ]);
  });

  it("given the suffix only as padding, with a count of 0, when checked, then it is not breached", async () => {
    const { fetcher } = answering(`${suffix}:0`);

    expect(await isBreached("password", fetcher)).toBe(false);
  });

  it("given the service failing, when checked, then it throws for the caller to decide", async () => {
    const { fetcher } = answering("", 503);

    await expect(isBreached("password", fetcher)).rejects.toThrow(/503/);
  });
});
