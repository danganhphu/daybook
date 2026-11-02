// D1's limits that code has to respect (developers.cloudflare.com/d1/platform/limits)
export const d1MaxBoundParameters = 100;

// Reads by a list of ids, one query per chunk small enough for D1's bound parameters - `taken` of them already bound
// by the rest of the statement - the chunks together. A day of many messages, or a long pick in the trash, stays
// under the limit.
export async function readInChunks<Id, Row>(
  ids: ReadonlyArray<Id>,
  read: (chunk: ReadonlyArray<Id>) => Promise<ReadonlyArray<Row>>,
  taken = 0,
): Promise<Row[]> {
  const size = d1MaxBoundParameters - taken;
  const chunks = Array.from({ length: Math.ceil(ids.length / size) }, (_, index) =>
    ids.slice(index * size, (index + 1) * size),
  );

  return (await Promise.all(chunks.map(read))).flat();
}
