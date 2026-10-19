// Writes queued on a unit of work's stores are applied together on commit: all of them, or none.
// A use case names the stores it writes to; the composition root decides how they share one transaction.
export type UnitOfWork<Stores extends object> = Stores & {
  commit(): Promise<void>;
};
