import type { Capture, CaptureId } from "./capture";

// Reads only; a capture is written once, beside its note
export type CaptureRepository = {
  get(id: CaptureId): Promise<Capture | undefined>;
};
