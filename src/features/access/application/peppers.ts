// The secret mixed into every password verifier, kept as a Worker secret and never in the database, so a copy of
// D1 alone is no help in testing guesses (OWASP Password Storage cheat sheet, "Peppering"). Versioned: a new pepper
// can take over while verifiers made with the old one still check, until each is set again.
export type Pepper = {
  readonly version: number;
  readonly key: Uint8Array<ArrayBuffer>;
};

export type Peppers = {
  readonly current: Pepper;
  byVersion(version: number): Pepper | undefined;
};
