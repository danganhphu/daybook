// The cryptography sign-in needs, as a port: the Worker and the operator's command each bring an implementation
export type Secrets = {
  randomBytes(length: number): Uint8Array<ArrayBuffer>;
  sha256(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>>;
  hmacSha256(
    key: Uint8Array<ArrayBuffer>,
    data: Uint8Array<ArrayBuffer>,
  ): Promise<Uint8Array<ArrayBuffer>>;
  // Compares in time that does not depend on where the inputs differ
  equalInConstantTime(a: Uint8Array<ArrayBuffer>, b: Uint8Array<ArrayBuffer>): boolean;
};
