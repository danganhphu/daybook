import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { expect } from "@playwright/test";
import { createBdd, test as base } from "playwright-bdd";
import { z } from "zod";

import { sessionCookieName } from "@/features/access/web/cookie-names";

import { fixturesFile, setupLinksUsedFile, staleSessionsUsedFile } from "./paths";
import { todayPage, type TodayPage } from "./today-page";

const seededSchema = z.object({
  sessionCookie: z.string(),
  staleSessionCookies: z.array(z.string()).min(1),
  lanPassword: z.string(),
  setupTokens: z.array(z.string()).min(1),
});

export type Access = {
  // Lan's session, as if she had signed in on this browser
  signIn(): Promise<void>;
  // Lan's session from long enough ago that security settings ask her to confirm again
  signInLongAgo(): Promise<void>;
  readonly lanPassword: string;
  // A setup link nobody has opened yet, for Minh
  nextSetupToken(): string;
};

// The next of a seeded list nobody has used yet. The count lives in a file, so it holds across scenarios, projects
// and retries in one run.
function spendNext(list: ReadonlyArray<string>, usedFile: string, what: string): string {
  const used = existsSync(usedFile) ? Number(readFileSync(usedFile, "utf8")) : 0;
  const next = list[used];
  if (next === undefined) {
    throw new Error(`All ${list.length} seeded ${what} are spent`);
  }
  writeFileSync(usedFile, String(used + 1));

  return next;
}

export const test = base.extend<{
  today: TodayPage;
  access: Access;
  // What one step of a scenario found for a later one, such as a link shown once; fresh for every scenario
  remembered: Map<string, string>;
}>({
  // oxlint-disable-next-line no-empty-pattern -- Playwright reads a fixture's dependencies from this pattern
  remembered: async ({}, use) => {
    await use(new Map());
  },

  // Every page, in every scenario: a script the CSP blocked or an error nobody caught fails the test
  page: async ({ page }, use) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /Content Security Policy/i.test(message.text())) {
        problems.push(message.text());
      }
    });
    page.on("pageerror", (error) => problems.push(error.message));

    await use(page);

    expect(problems).toEqual([]);
  },

  today: async ({ page }, use) => {
    await use(todayPage(page));
  },

  access: async ({ context, baseURL }, use) => {
    const seeded = seededSchema.parse(JSON.parse(readFileSync(fixturesFile, "utf8")));

    async function setSession(value: string) {
      await context.addCookies([
        {
          name: sessionCookieName,
          value,
          url: baseURL ?? "",
          secure: true,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    }

    await use({
      signIn: () => setSession(seeded.sessionCookie),
      signInLongAgo: () =>
        setSession(spendNext(seeded.staleSessionCookies, staleSessionsUsedFile, "stale sessions")),
      lanPassword: seeded.lanPassword,
      nextSetupToken: () => spendNext(seeded.setupTokens, setupLinksUsedFile, "setup links"),
    });
  },
});

export const { Given, When, Then } = createBdd(test);
