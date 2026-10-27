// Words sent but not yet saved, kept by this tab: a send that ends at sign-in, because the session has run out, comes
// back to the box afterwards
const unsentKey = "daybook:unsent";

export function keepUnsent(texts: Iterable<string>): void {
  const kept = [...texts].join("\n");
  try {
    if (kept === "") {
      sessionStorage.removeItem(unsentKey);
    } else {
      sessionStorage.setItem(unsentKey, kept);
    }
  } catch {
    // Storage turned off: a failed send still puts its words back in the box
  }
}

export function takeUnsent(): string {
  try {
    const kept = sessionStorage.getItem(unsentKey) ?? "";
    sessionStorage.removeItem(unsentKey);
    return kept;
  } catch {
    return "";
  }
}
