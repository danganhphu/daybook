/// <reference types="vite/client" />
// import.meta.glob is Vite's; vitest runs this file through Vite

import { describe, expect, it } from "vitest";

// The browser loads Zod only on the passkey screens (AGENTS.md). This follows every client module's imports through
// the source, so a form that imports an aggregate for one constant fails here rather than in a phone's download.

const sources = import.meta.glob<string>("/src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});

// The one module that parses with Zod in the browser
const allowedZod = new Set(["/src/features/access/web/browser-options.ts"]);
// Answers 404 in production
const devOnly = "/src/app/dev/";

const isTest = (path: string) => /\.test\.tsx?$/.test(path);
const isClient = (text: string) => /^\s*["']use client["'];/.test(text);
const isServerActions = (text: string) => /^\s*["']use server["'];/.test(text);

const importPattern =
  /^(?:import|export)\s+(type\s+)?([^;]*?)\s*from\s+"([^"]+)";|^import\s+"([^"]+)";|import\(\s*"([^"]+)"\s*\)/gm;

// What a module imports for its values; `import type` and imports of types alone are erased
function valueImports(text: string): string[] {
  return text
    .matchAll(importPattern)
    .filter(([, typeOnly, names]) => {
      if (typeOnly !== undefined) {
        return false;
      }
      const braced = names?.trim().match(/^\{([\s\S]*)\}$/)?.[1];
      return (
        braced === undefined ||
        braced
          .split(",")
          .map((name) => name.trim())
          .some((name) => name !== "" && !name.startsWith("type "))
      );
    })
    .map(([, , , from, bare, dynamic]) => from ?? bare ?? dynamic ?? "")
    .toArray();
}

function resolve(importer: string, specifier: string): string | undefined {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = `/src/${specifier.slice(2)}`;
  } else if (specifier.startsWith(".")) {
    base = new URL(specifier, `file://${importer}`).pathname;
  } else {
    return undefined;
  }

  return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((path) => path in sources);
}

// Each module the browser would load that imports Zod itself, with the chain that brought it in
function zodImporters(): string[] {
  const roots = Object.entries(sources)
    .filter(([path, text]) => !isTest(path) && !path.startsWith(devOnly) && isClient(text))
    .map(([path]) => path);
  const seen = new Set<string>();
  const found: string[] = [];

  function visit(path: string, chain: readonly string[]) {
    const text = sources[path] ?? "";
    if (seen.has(path) || (chain.length > 0 && isServerActions(text))) {
      return;
    }
    seen.add(path);
    for (const specifier of valueImports(text)) {
      if (specifier === "zod" || specifier.startsWith("zod/")) {
        if (!allowedZod.has(path)) {
          found.push([...chain, path].join(" -> "));
        }
        continue;
      }
      const next = resolve(path, specifier);
      if (next !== undefined) {
        visit(next, [...chain, path]);
      }
    }
  }

  for (const root of roots) {
    visit(root, []);
  }

  return found;
}

describe("what the browser loads", () => {
  it("given a client screen, when its imports are followed, then they reach the modules behind it", () => {
    const text = sources["/src/app/sign-in/sign-in-screen.tsx"] ?? "";

    expect(valueImports(text)).toContain("@/features/access/web/browser-options");
    expect(valueImports('import type { A } from "zod";\nimport { type B } from "./b";')).toEqual(
      [],
    );
  });

  it("given every client module, when its imports are followed, then none reaches Zod but the passkey screens'", () => {
    expect(zodImporters()).toEqual([]);
  });
});
