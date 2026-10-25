import type { CaptureId } from "@/features/capture/domain/capture";

import type { Interpretation } from "./interpretation";

// Reads only; writes go through the unit of work
export type InterpretationRepository = {
  // The newest reading of each capture that has one
  latestFor(captureIds: ReadonlyArray<CaptureId>): Promise<ReadonlyMap<CaptureId, Interpretation>>;
};
