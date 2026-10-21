import type { Ceremony, CeremonyId } from "./ceremony";

// Reads only. Writes go through the application's unit of work.
export type CeremonyRepository = {
  get(id: CeremonyId): Promise<Ceremony | undefined>;
};
