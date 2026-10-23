// A batch refused because a record it changes was saved by someone else after it was read. Thrown by the unit of work;
// a use case turns it into the "changed elsewhere" answer with commitUnlessStale.
export class StaleWriteError extends Error {
  constructor(options?: ErrorOptions) {
    super("A record changed after it was read", options);
    this.name = "StaleWriteError";
  }
}

// Commits the unit of work, or says another change got there first. Every other failure still throws.
export async function commitUnlessStale(work: {
  commit(): Promise<void>;
}): Promise<"committed" | "stale"> {
  try {
    await work.commit();
  } catch (error) {
    if (error instanceof StaleWriteError) {
      return "stale";
    }
    throw error;
  }

  return "committed";
}
