import type { Secrets } from "@/features/access/application/secrets";

type WorkersSubtleCrypto = SubtleCrypto & {
  timingSafeEqual(a: ArrayBufferView, b: ArrayBufferView): boolean;
};

// timingSafeEqual is the Workers runtime's addition to SubtleCrypto; the DOM types the app also compiles with lack it
function hasTimingSafeEqual(subtle: SubtleCrypto): subtle is WorkersSubtleCrypto {
  return "timingSafeEqual" in subtle && typeof subtle.timingSafeEqual === "function";
}

// Web Crypto, as the Workers runtime and Node both provide it. Only the Worker compares secrets; the operator's
// command never needs to, and would fail loudly rather than compare unsafely.
export const webCryptoSecrets: Secrets = {
  randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
  },

  async sha256(data) {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  },

  // Lengths are not secret here - every hash is 32 bytes - and timingSafeEqual throws on a mismatch
  equalInConstantTime(a, b) {
    if (!hasTimingSafeEqual(crypto.subtle)) {
      throw new Error(
        "Comparing secrets needs the Workers runtime's crypto.subtle.timingSafeEqual",
      );
    }

    return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
  },
};
