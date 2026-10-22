import { isoCBOR } from "@simplewebauthn/server/helpers";

import { decodeBase64Url, encodeBase64Url } from "@/shared/domain/base64url";

// A passkey authenticator in software, for tests: real keys, real signatures, and every field a test may want to
// get wrong on purpose. The verifier under test is the library, so a mistake here makes tests fail, not pass.

export type KeyAlgorithm = "ES256" | "Ed25519" | "RS256";

export type Flags = {
  readonly userPresent: boolean;
  readonly userVerified: boolean;
  readonly backupEligible: boolean;
  readonly backedUp: boolean;
};

// What a test may change about one response
export type Tampering = {
  readonly origin?: string;
  readonly rpId?: string;
  readonly type?: string;
  readonly challenge?: string;
  readonly flags?: Partial<Flags>;
  readonly counter?: number;
  readonly userHandle?: string | null;
  // Sign with a key other than the passkey's own
  readonly signWith?: CryptoKey;
};

export type SoftwarePasskey = {
  readonly credentialId: string;
  readonly userHandle: string;
  readonly algorithm: KeyAlgorithm;
  readonly keys: CryptoKeyPair;
};

type CreationOptions = {
  readonly challenge: string;
  readonly user: { readonly id: string };
};

type RequestOptions = {
  readonly challenge: string;
};

const defaultFlags: Flags = {
  userPresent: true,
  userVerified: true,
  backupEligible: true,
  backedUp: true,
};

type Cbor = Parameters<typeof isoCBOR.encode>[0];

// An authenticator model the test passkey claims to be. Any 16 bytes will do; this is not a real provider's.
const aaguid = Uint8Array.from({ length: 16 }, (_, index) => index + 1);

const utf8 = new TextEncoder();

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

function concat(...parts: ReadonlyArray<Uint8Array>): Uint8Array<ArrayBuffer> {
  const joined = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }

  return joined;
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);

  return bytes;
}

function uint16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value);

  return bytes;
}

function flagsByte(flags: Flags, attested: boolean): Uint8Array {
  return Uint8Array.of(
    (flags.userPresent ? 0x01 : 0) |
      (flags.userVerified ? 0x04 : 0) |
      (flags.backupEligible ? 0x08 : 0) |
      (flags.backedUp ? 0x10 : 0) |
      (attested ? 0x40 : 0),
  );
}

export async function generateKeys(algorithm: KeyAlgorithm): Promise<CryptoKeyPair> {
  const parameters = {
    ES256: { name: "ECDSA", namedCurve: "P-256" },
    Ed25519: { name: "Ed25519" },
    RS256: {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: Uint8Array.of(1, 0, 1),
      hash: "SHA-256",
    },
  }[algorithm];

  const generated = await crypto.subtle.generateKey(parameters, true, ["sign", "verify"]);
  if (!("privateKey" in generated)) {
    throw new Error(`${algorithm} gave a single key, not a pair`);
  }

  return generated;
}

function jwkBytes(field: string | undefined): Uint8Array {
  if (field === undefined) {
    throw new Error("The exported key is missing a field the COSE key needs");
  }

  return decodeBase64Url(field);
}

// The public key as COSE (RFC 9053): key type, algorithm, then the curve and coordinates, or the RSA modulus and
// exponent
const coseFields: Record<
  KeyAlgorithm,
  (jwk: JsonWebKey) => ReadonlyArray<readonly [number, Cbor]>
> = {
  ES256: (jwk) => [
    [1, 2],
    [3, -7],
    [-1, 1],
    [-2, jwkBytes(jwk.x)],
    [-3, jwkBytes(jwk.y)],
  ],
  Ed25519: (jwk) => [
    [1, 1],
    [3, -8],
    [-1, 6],
    [-2, jwkBytes(jwk.x)],
  ],
  RS256: (jwk) => [
    [1, 3],
    [3, -257],
    [-1, jwkBytes(jwk.n)],
    [-2, jwkBytes(jwk.e)],
  ],
};

async function cosePublicKey(algorithm: KeyAlgorithm, publicKey: CryptoKey): Promise<Uint8Array> {
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);

  return isoCBOR.encode(new Map<number, Cbor>(coseFields[algorithm](jwk)));
}

// WebAuthn wants ECDSA signatures in ASN.1 DER; Web Crypto gives r and s side by side
function derEcdsaSignature(raw: Uint8Array): Uint8Array {
  const integer = (bytes: Uint8Array) => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) {
      start += 1;
    }
    const trimmed = bytes.slice(start);
    const value = (trimmed[0] ?? 0) & 0x80 ? concat(Uint8Array.of(0), trimmed) : trimmed;

    return concat(Uint8Array.of(0x02, value.length), value);
  };
  const body = concat(integer(raw.slice(0, 32)), integer(raw.slice(32)));

  return concat(Uint8Array.of(0x30, body.length), body);
}

async function sign(
  algorithm: KeyAlgorithm,
  key: CryptoKey,
  data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array> {
  const parameters = {
    ES256: { name: "ECDSA", hash: "SHA-256" },
    Ed25519: { name: "Ed25519" },
    RS256: { name: "RSASSA-PKCS1-v1_5" },
  }[algorithm];
  const signature = new Uint8Array(await crypto.subtle.sign(parameters, key, data));

  return algorithm === "ES256" ? derEcdsaSignature(signature) : signature;
}

function clientData(type: string, challenge: string, origin: string): Uint8Array<ArrayBuffer> {
  return utf8.encode(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
}

export function softwareAuthenticator(site: { readonly origin: string; readonly rpId: string }) {
  return {
    // navigator.credentials.create(), as @simplewebauthn/browser would hand its answer back
    async create(
      options: CreationOptions,
      tampering: Tampering & {
        readonly algorithm?: KeyAlgorithm;
        // Register this existing credential again instead of making a new one
        readonly reuse?: SoftwarePasskey;
      } = {},
    ) {
      const algorithm = tampering.reuse?.algorithm ?? tampering.algorithm ?? "ES256";
      const keys = tampering.reuse?.keys ?? (await generateKeys(algorithm));
      const credentialId =
        tampering.reuse === undefined
          ? crypto.getRandomValues(new Uint8Array(16))
          : decodeBase64Url(tampering.reuse.credentialId);
      const flags = { ...defaultFlags, ...tampering.flags };

      const authenticatorData = concat(
        await sha256(utf8.encode(tampering.rpId ?? site.rpId)),
        flagsByte(flags, true),
        uint32(tampering.counter ?? 0),
        aaguid,
        uint16(credentialId.length),
        credentialId,
        await cosePublicKey(algorithm, keys.publicKey),
      );
      const attestationObject = isoCBOR.encode(
        new Map<string, Cbor>([
          ["fmt", "none"],
          ["attStmt", new Map<string, Cbor>()],
          ["authData", authenticatorData],
        ]),
      );
      const id = encodeBase64Url(credentialId);

      return {
        passkey: { credentialId: id, userHandle: options.user.id, algorithm, keys },
        response: {
          id,
          rawId: id,
          type: "public-key",
          response: {
            clientDataJSON: encodeBase64Url(
              clientData(
                tampering.type ?? "webauthn.create",
                tampering.challenge ?? options.challenge,
                tampering.origin ?? site.origin,
              ),
            ),
            attestationObject: encodeBase64Url(attestationObject),
            transports: ["internal", "hybrid"],
          },
          clientExtensionResults: { credProps: { rk: true } },
          authenticatorAttachment: "platform",
        },
      };
    },

    // navigator.credentials.get() with a passkey this authenticator made
    async get(options: RequestOptions, passkey: SoftwarePasskey, tampering: Tampering = {}) {
      const flags = { ...defaultFlags, ...tampering.flags };
      const authenticatorData = concat(
        await sha256(utf8.encode(tampering.rpId ?? site.rpId)),
        flagsByte(flags, false),
        uint32(tampering.counter ?? 0),
      );
      const clientDataJSON = clientData(
        tampering.type ?? "webauthn.get",
        tampering.challenge ?? options.challenge,
        tampering.origin ?? site.origin,
      );
      const signature = await sign(
        passkey.algorithm,
        tampering.signWith ?? passkey.keys.privateKey,
        concat(authenticatorData, await sha256(clientDataJSON)),
      );
      const userHandle =
        tampering.userHandle === undefined ? passkey.userHandle : tampering.userHandle;

      return {
        id: passkey.credentialId,
        rawId: passkey.credentialId,
        type: "public-key",
        response: {
          clientDataJSON: encodeBase64Url(clientDataJSON),
          authenticatorData: encodeBase64Url(authenticatorData),
          signature: encodeBase64Url(signature),
          ...(userHandle === null ? {} : { userHandle }),
        },
        clientExtensionResults: {},
        authenticatorAttachment: "platform",
      };
    },
  };
}
