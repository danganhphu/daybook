// Every way a notification use case is known to fail. Adapters branch on the code; the sentences are in the web copy.
export type NotificationError =
  // No VAPID keys are configured, so nothing could be sent
  | "push_unavailable"
  // A browser handed over an address that is not a known push service's
  | "push_service_unknown"
  | "not_found"
  | "times_changed_elsewhere";
