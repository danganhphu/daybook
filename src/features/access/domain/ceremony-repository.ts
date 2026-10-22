import type { Ceremony, CeremonyId, Challenge } from "./ceremony";

// Reads, and the one write that cannot wait for a unit of work: spending a challenge has to be settled before the
// response is verified, so that two responses to one challenge cannot both get through.
export type CeremonyRepository = {
  get(id: CeremonyId): Promise<Ceremony | undefined>;
  // Clears the challenge if it is still the one given. True for exactly one caller.
  spendChallenge(id: CeremonyId, challenge: Challenge): Promise<boolean>;
};
