import type { Interpretation } from "@/features/reading/domain/interpretation";

// Queues a reading on the current unit of work, beside whatever was made from it
export type InterpretationWrites = {
  add(interpretation: Interpretation): void;
};
