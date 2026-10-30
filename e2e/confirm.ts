import type { Page } from "@playwright/test";

// Every delete asks first: a dialog named by its question, answered with its verb
export async function answer(page: Page, question: string, verb: string) {
  await page
    .getByRole("dialog", { name: question, exact: true })
    .getByRole("button", { name: verb, exact: true })
    .click();
}
