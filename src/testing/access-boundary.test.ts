/// <reference types="vite/client" />
// import.meta.glob is Vite's; vitest runs this file through Vite

import { describe, expect, it } from "vitest";

// Authorization sits next to the data (ADR 0009, decision 6): every server action and every page checks the session
// itself, and the proxy's redirect is only a shortcut. This reads the source, so a new action or page that forgets
// fails here rather than in production. The few that must work signed out are named below, on purpose.

const sources = import.meta.glob<string>("/src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});

// How a session comes to exist, or ends; nothing here can require one
const publicActionModules = new Set(["/src/app/sign-in/actions.ts", "/src/app/setup/actions.ts"]);
const publicPages = new Set([
  "/src/app/sign-in/page.tsx",
  "/src/app/setup/page.tsx",
  // Holds no data and answers 404 in production
  "/src/app/dev/ui/page.tsx",
]);
// Signs out whoever asks, with or without a session
const publicRoutes = new Set(["/src/app/sign-out/route.ts"]);

const isTest = (path: string) => /\.test\.tsx?$/.test(path);

function filesMatching(test: (path: string, text: string) => boolean) {
  return Object.entries(sources)
    .filter(([path, text]) => !isTest(path) && test(path, text))
    .map(([path]) => path)
    .toSorted();
}

const serverActionModules = filesMatching((_, text) => /^\s*["']use server["'];/.test(text));
const pages = filesMatching((path) => path.startsWith("/src/app/") && path.endsWith("/page.tsx"));
const routes = filesMatching((path) => path.startsWith("/src/app/") && path.endsWith("/route.ts"));

// Each exported function, with its body up to the next top-level declaration
function exportedFunctions(text: string) {
  return text
    .matchAll(/^export async function (\w+)\([\s\S]*?(?=^(?:export |function |\/\/|$(?![\s\S])))/gm)
    .map(([body, name]) => ({ name: name ?? "", body }))
    .toArray();
}

describe("the access boundary", () => {
  it("given the source tree, when read, then the checks below have something to check", () => {
    expect(serverActionModules).toContain("/src/app/actions.ts");
    expect(pages).toContain("/src/app/(app)/page.tsx");
  });

  it("given the public lists, when compared with the source tree, then none names a file that is gone", () => {
    for (const path of [...publicActionModules, ...publicPages, ...publicRoutes]) {
      expect(Object.keys(sources)).toContain(path);
    }
  });

  it.each(serverActionModules.filter((path) => !publicActionModules.has(path)))(
    "given the server actions in %s, when read, then each one checks the session first",
    (path) => {
      const actions = exportedFunctions(sources[path] ?? "");

      expect(actions.length).toBeGreaterThan(0);
      for (const action of actions) {
        expect(action.body, `${path}: ${action.name}`).toMatch(/await requireSession\(/);
      }
    },
  );

  it.each(pages.filter((path) => !publicPages.has(path)))(
    "given the page %s, when read, then it checks the session",
    (path) => {
      expect(sources[path]).toMatch(/await requireSession\(/);
    },
  );

  it("given the route handlers, when listed, then each one is a deliberate public route", () => {
    expect(routes.filter((path) => !publicRoutes.has(path))).toEqual([]);
  });
});
