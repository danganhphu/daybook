// Unpadded base64url (RFC 4648 section 5), for random bytes and hashes stored as text.
// Uint8Array.toBase64 is not in every browser this app supports yet, so btoa and atob do the work.

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

// The length of n bytes once encoded, which the schemas and table checks pin
export function base64UrlLength(byteLength: number): number {
  return Math.ceil((byteLength * 4) / 3);
}
