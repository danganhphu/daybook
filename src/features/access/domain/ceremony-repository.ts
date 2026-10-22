import type { Ceremony, CeremonyId, Challenge } from "./ceremony";

// Reads, and the writes that cannot wait for a unit of work: spending a ceremony has to be settled before what the
// browser sent is verified, so that two answers to one ceremony cannot both get through.
export type CeremonyRepository = {
  get(id: CeremonyId): Promise<Ceremony | undefined>;
  // Clears the challenge if it is still the one given. True for exactly one caller.
  spendChallenge(id: CeremonyId, challenge: Challenge): Promise<boolean>;
  // Deletes it, for a step finished in one go. True for exactly one caller.
  take(id: CeremonyId): Promise<boolean>;
};
