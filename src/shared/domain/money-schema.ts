import { z } from "zod";

import { checkedSchema } from "./checked-schema";
import { parseMoney } from "./money";

export const moneySchema = checkedSchema(z.number({ error: "Số tiền phải là số" }), parseMoney);
