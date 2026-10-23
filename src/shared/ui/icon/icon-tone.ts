// The colour of an icon says what it is about, the same everywhere in the app (docs/ui/design-system.md, "Icon
// tones"). A screen asks for a meaning, never for a colour.
export type IconTone = "green" | "blue" | "orange" | "red" | "purple" | "amber" | "neutral";

export const iconTones = {
  // Money that came in or will: a total, revenue, a payment
  money: "green",
  // People: a customer, a call
  customer: "blue",
  // What is still owed
  owed: "orange",
  // Removing, deleting
  danger: "red",
  // Getting goods to the customer
  delivery: "purple",
  // Words written down: a note, an address, the history
  note: "amber",
  // A product, a kind: things the book lists
  item: "neutral",
} as const satisfies Record<string, IconTone>;
