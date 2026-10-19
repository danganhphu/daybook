import type { Capture } from "@/features/capture/domain/capture";

// Queues a capture on the current unit of work; nothing is stored until it commits
export type CaptureWrites = {
  add(capture: Capture): void;
};
