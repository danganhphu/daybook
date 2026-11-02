import { refresh } from "next/cache";

// For server actions. vinext leaves a page as it was after an action, so one that changes something renders it again.

// After any answer: a change shows, and a refusal almost always means the page was out of date - changed elsewhere -
// so it shows what is stored now
export function refreshed<R>(result: R): R {
  refresh();

  return result;
}

// Only after a change that went through: a refusal the person can fix - a wrong password, words the box still holds -
// leaves the screen as it is
export function refreshedOnSuccess<R extends { readonly ok: boolean }>(result: R): R {
  if (result.ok) {
    refresh();
  }

  return result;
}
