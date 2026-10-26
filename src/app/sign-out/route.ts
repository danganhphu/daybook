import { daybook } from "@/composition/daybook";
import { clearSessionCookie, requestOrigin } from "@/features/access/web/request-context";
import { currentSession } from "@/features/access/web/session-gate";
import { routes } from "@/shared/web/routes";

// A form POST rather than a server action, because only a response can carry Clear-Site-Data. The proxy refuses it
// from any other site, so a stranger's page cannot sign anyone out.
export async function POST() {
  const app = daybook();
  const session = await currentSession(app);
  if (session !== undefined) {
    await app.signOut(session, await requestOrigin());
  }
  await clearSessionCookie();

  return new Response(null, {
    status: 303,
    // The browser drops this site's cookies, cached pages and storage too, whatever the server missed, so Back on a
    // shared phone shows nothing (W3C Clear Site Data). Passkeys live in the phone's password manager, not here.
    headers: { location: routes.signIn, "clear-site-data": '"cache", "cookies", "storage"' },
  });
}
