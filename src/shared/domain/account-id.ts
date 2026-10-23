import { z } from "zod";

// Who did something: the id of one of the people sharing the book. Shared by every feature that records an actor;
// the account itself belongs to the access feature.
export const accountIdSchema = z.uuid().brand<"AccountId">();

export type AccountId = z.infer<typeof accountIdSchema>;
