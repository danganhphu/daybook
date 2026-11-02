import type { Capture, CaptureId, CaptureSource, SourceRef } from "./capture";

// Reads only; a capture is written once, beside its note
export type CaptureRepository = {
  get(id: CaptureId): Promise<Capture | undefined>;
  findBySourceRef(source: CaptureSource, sourceRef: SourceRef): Promise<Capture | undefined>;
};
