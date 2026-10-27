import { z } from "zod";

import { checkedSchema } from "./checked-schema";
import { parseContent } from "./content";

export const contentSchema = checkedSchema(z.unknown(), parseContent);
