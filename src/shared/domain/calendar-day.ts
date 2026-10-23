import { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

// A calendar day as it travels in a URL or a form: YYYY-MM-DD, nothing else. A day that does not exist (30
// February) is refused, never moved to a nearby one.
export const calendarDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((text, context) => {
    try {
      return Temporal.PlainDate.from(text, { overflow: "reject" });
    } catch {
      context.addIssue({ code: "custom", message: "Ngày không có thật" });
      return z.NEVER;
    }
  });
