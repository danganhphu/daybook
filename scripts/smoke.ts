// Run after a deploy, against the live app: `pnpm smoke https://daybook.<subdomain>.workers.dev`. Reads only - a
// page, the service worker, the webhook refusing a request without its secret - and says what it found. Exits with
// an error when something is off, so it can be run from a script.
import { webhookPath } from "@/bot/webhook-path";

const origin = new URL(process.argv[2] ?? "");

type Check = { readonly what: string; readonly ok: boolean; readonly saw: string };

async function page(): Promise<ReadonlyArray<Check>> {
  const response = await fetch(new URL("/sign-in", origin), { redirect: "manual" });
  const header = (name: string) => response.headers.get(name) ?? "missing";

  return [
    {
      what: "the sign-in page answers 200",
      ok: response.status === 200,
      saw: String(response.status),
    },
    ...["strict-transport-security", "content-security-policy", "referrer-policy"].map((name) => ({
      what: `the page sends ${name}`,
      ok: response.headers.has(name),
      saw: header(name),
    })),
    {
      what: "the page sends nosniff",
      ok: header("x-content-type-options") === "nosniff",
      saw: header("x-content-type-options"),
    },
  ];
}

async function serviceWorker(): Promise<ReadonlyArray<Check>> {
  const response = await fetch(new URL("/sw.js", origin));
  const csp = response.headers.get("content-security-policy") ?? "missing";
  const caching = response.headers.get("cache-control") ?? "missing";

  return [
    { what: "/sw.js allows only its own origin", ok: csp === "default-src 'self'", saw: csp },
    { what: "/sw.js is never cached", ok: caching.includes("no-cache"), saw: caching },
  ];
}

// 401 when the bot is set up, 404 when it is off; anything else is wrong either way
async function webhook(): Promise<ReadonlyArray<Check>> {
  const response = await fetch(new URL(webhookPath, origin), { method: "POST", body: "{}" });
  const state =
    response.status === 401 ? "bot on" : response.status === 404 ? "bot off" : "unexpected";

  return [
    {
      what: "the webhook refuses a request without its secret",
      ok: state !== "unexpected",
      saw: `${response.status} (${state})`,
    },
  ];
}

const checks = (await Promise.all([page(), serviceWorker(), webhook()])).flat();
for (const check of checks) {
  console.log(`${check.ok ? "ok  " : "FAIL"} ${check.what}: ${check.saw}`);
}
if (checks.some((check) => !check.ok)) {
  throw new Error("The deploy needs a look: see FAIL above");
}
