import type { Customer, CustomerId } from "@/features/customers/domain/customer";
import type { CustomerRepository } from "@/features/customers/domain/customer-repository";
import { nameWords } from "@/features/reading/domain/customer-words";
import { searchTermSchema } from "@/shared/domain/search-text";

export type CustomerMatch =
  | { readonly found: "one"; readonly customerId: CustomerId }
  | { readonly found: "none" }
  | { readonly found: "many"; readonly candidates: ReadonlyArray<CustomerId> };

// Enough for namesakes, few enough to tap through on a phone
export const candidateLimit = 4;

// Far more than one name matches in a book of two people's customers
const searchLimit = 50;

function holdsEvery(name: ReadonlyArray<string>, words: ReadonlyArray<string>): boolean {
  return words.every((word) => name.includes(word));
}

function sameWords(name: ReadonlyArray<string>, words: ReadonlyArray<string>): boolean {
  return name.length === words.length && holdsEvery(name, words);
}

// The active customer a written name means, the way the order form's suggestions find one: every word of the name
// or of another name they are known by, with or without accents. A name that is exactly one customer's is that
// customer even when others hold its words.
export async function matchCustomer(
  customers: CustomerRepository,
  written: string | null,
): Promise<CustomerMatch> {
  const words = written === null ? [] : nameWords(written);
  const term = searchTermSchema.safeParse(words.join(" "));
  if (!term.success) {
    return { found: "none" };
  }

  const found = await customers.list({ search: term.data, status: "active" }, searchLimit);
  const aliases = await customers.aliasesOf(found.map((customer) => customer.id));
  const holding = found
    .map((customer): [Customer, ReadonlyArray<ReadonlyArray<string>>] => [
      customer,
      [customer.name, ...(aliases.get(customer.id) ?? []).map((alias) => alias.name)].map(
        nameWords,
      ),
    ])
    .filter(([, names]) => names.some((name) => holdsEvery(name, words)));
  const exact = holding.filter(([, names]) => names.some((name) => sameWords(name, words)));

  const closest = exact.length === 1 ? exact : holding;
  const [first] = closest;
  if (first === undefined) {
    return { found: "none" };
  }
  if (closest.length === 1) {
    return { found: "one", customerId: first[0].id };
  }

  return {
    found: "many",
    candidates: (exact.length > 1 ? exact : holding)
      .slice(0, candidateLimit)
      .map(([customer]) => customer.id),
  };
}
