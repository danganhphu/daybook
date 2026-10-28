import type { AccessLogPosition } from "@/features/access/domain/access-event-repository";

// How far the relay of security notices has read the access log. Reads only.
export type NoticeCursorRepository = {
  get(): Promise<AccessLogPosition | undefined>;
};
