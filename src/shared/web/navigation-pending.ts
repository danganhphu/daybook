// Navigations under way, counted by the links that started them, for the bar along the top
let pending = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

// Returns its own end, which is safe to call more than once
export function beginNavigation(): () => void {
  pending += 1;
  notify();
  let ended = false;

  return () => {
    if (!ended) {
      ended = true;
      pending -= 1;
      notify();
    }
  };
}

export function subscribeToNavigations(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function isNavigating(): boolean {
  return pending > 0;
}
