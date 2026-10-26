// A name of this scenario's own: the three devices run against one book, so a customer or product a scenario makes
// gets a short suffix, and later steps of the same scenario find it by the name the feature file says
export function ownName(remembered: Map<string, string>, name: string): string {
  const known = remembered.get(name);
  if (known !== undefined) {
    return known;
  }

  const own = `${name} ${crypto.randomUUID().slice(0, 4)}`;
  remembered.set(name, own);

  return own;
}
