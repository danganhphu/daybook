import { z } from "zod";

// The passkey aggregate arrives with step 2 of the sign-in plan; sessions already name the passkey they came from

export const passkeyIdSchema = z.uuid().brand<"PasskeyId">();

export type PasskeyId = z.infer<typeof passkeyIdSchema>;
