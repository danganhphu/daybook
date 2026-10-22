import { argon2idAsync } from "@noble/hashes/argon2.js";

import { derivedKeyByteLength, passwordLength } from "@/features/access/domain/access-policy";
import type { Argon2Parameters } from "@/features/access/domain/password";
import { decodeBase64Url, encodeBase64Url } from "@/shared/domain/base64url";
import { err, ok, type Result } from "@/shared/domain/result";

// The password's whole life on the device: normalised, checked, turned into a key. The password itself never
// leaves the browser; the server sees only the key (ADR 0009, decision 2).

export const passwordMessages = {
  // Under the field: long beats complicated (NIST 800-63B-4, 3.1.1.2 sets no composition rules)
  hint: `Ít nhất ${passwordLength.minimum} ký tự. Nên dùng một câu dễ nhớ.`,
  tooShort: `Mật khẩu cần ít nhất ${passwordLength.minimum} ký tự.`,
  tooLong: `Mật khẩu tối đa ${passwordLength.maximum} ký tự.`,
  breached: "Mật khẩu này đã bị lộ trong các vụ rò rỉ dữ liệu. Hãy chọn mật khẩu khác.",
  uncheckable: "Không kiểm tra được mật khẩu. Hãy kiểm tra mạng rồi thử lại.",
} as const;

// NFKC, so a password typed with Telex, VNI or a phone keyboard is one string whatever form the characters arrive in
// (NIST 800-63B-4, 3.1.1.2)
export function normalizePassword(text: string): string {
  return text.normalize("NFKC");
}

// NIST 800-63B-4, 3.1.1.2: each Unicode code point counts as one character, so "ệ" after NFKC and an emoji are one
// each, not the two UTF-16 units JavaScript's length would count
export function checkPasswordLength(normalized: string): Result<string, string> {
  const length = normalized.match(/./gsu)?.length ?? 0;
  if (length < passwordLength.minimum) {
    return err(passwordMessages.tooShort);
  }
  if (length > passwordLength.maximum) {
    return err(passwordMessages.tooLong);
  }

  return ok(normalized);
}

const utf8 = new TextEncoder();

// Have I Been Pwned's range API: only the first five hex digits of the SHA-1 leave the device (k-anonymity), and
// Add-Padding hides how many suffixes came back. Throws when the service cannot be reached; the caller decides.
export async function isBreached(
  normalized: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", utf8.encode(normalized)));
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  const response = await fetcher(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, {
    headers: { "Add-Padding": "true" },
  });
  if (!response.ok) {
    throw new Error(`Pwned Passwords answered ${response.status}`);
  }

  const suffix = hex.slice(5);
  // Padding lines carry a count of 0 and are never a match
  return (await response.text()).split("\n").some((line) => {
    const [candidate, count] = line.trim().split(":");
    return candidate === suffix && Number(count) > 0;
  });
}

// Argon2id with the salt and cost the server handed out. Async, so the page stays responsive for the second or so
// it takes on a phone.
export async function deriveKey(
  normalized: string,
  salt: string,
  parameters: Argon2Parameters,
): Promise<string> {
  const key = await argon2idAsync(utf8.encode(normalized), decodeBase64Url(salt), {
    t: parameters.iterations,
    m: parameters.memoryKib,
    p: parameters.parallelism,
    dkLen: derivedKeyByteLength,
    maxmem: parameters.memoryKib * 1024 * 2,
    asyncTick: 10,
  });

  return encodeBase64Url(key);
}
