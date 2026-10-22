import { routes } from "@/shared/web/routes";

// Where a setup link points: the token in the fragment, which the browser never sends to any server, so it stays out
// of logs and Referer headers
export function setupLinkUrl(appOrigin: URL, token: string): string {
  const url = new URL(routes.setup, appOrigin);
  url.hash = token;

  return url.href;
}
