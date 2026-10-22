import { routes } from "@/shared/web/routes";

// After signing in or setting up: a full load, so every server component reads the new session, and a replace, so
// Back does not return to the sign-in screen
export function enterApp(): void {
  window.location.replace(routes.today);
}
