// Who the passkeys belong to. The RP ID is the full host: workers.dev is on the Public Suffix List, so no parent
// domain could serve as one (ADR 0009). The origin comes from configuration, never from a request header.
export type RelyingParty = {
  readonly id: string;
  readonly origin: string;
  readonly name: string;
};

// The app's own origin, as configured, decides both: the host is the RP ID
export function relyingPartyFor(appOrigin: URL, name: string): RelyingParty {
  return { id: appOrigin.hostname, origin: appOrigin.origin, name };
}
