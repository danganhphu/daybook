import { createBdd, test as base } from "playwright-bdd";

import { todayPage, type TodayPage } from "./today-page";

export const test = base.extend<{ today: TodayPage }>({
  today: async ({ page }, use) => {
    await use(todayPage(page));
  },
});

export const { Given, When, Then } = createBdd(test);
