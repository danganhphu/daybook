import { routes } from "@/shared/web/routes";

// Left for the page that opens next: a new session began in this tab, so what belongs to a session - this browser's
// notifications - can move onto it
const newSessionKey = "daybook.newSession";

// After signing in or setting up: a full load, so every server component reads the new session, and a replace, so
// Back does not return to the sign-in screen
export function enterApp(): void {
  try {
    sessionStorage.setItem(newSessionKey, "1");
  } catch {
    // Storage refused (a private window): the browser keeps its subscription, Settings turns it back on
  }
  window.location.replace(routes.today);
}

// Whether this page load follows a sign-in in this tab. Answers once.
export function tookNewSession(): boolean {
  try {
    const took = sessionStorage.getItem(newSessionKey) !== null;
    sessionStorage.removeItem(newSessionKey);
    return took;
  } catch {
    return false;
  }
}
