import { expect, type Page } from "@playwright/test";

import { answer } from "./confirm";
import { Then, When } from "./fixtures";
import { ownName } from "./own-names";

// "Đã xoá gần đây", reached from Settings, found by role and by the words on screen. Notes a scenario writes for it
// are its own, so the other devices' runs on the same book never match them.

function escaped(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

// A row's own menu, named after it. The latest deleted comes first: other runs on the same book may have deleted the
// same words before.
async function pickOnRow(page: Page, text: string, item: string) {
  await page
    .getByRole("main")
    .getByRole("button", { name: `Tuỳ chọn cho ${text}`, exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

When("tôi mở Đã xoá gần đây từ Cài đặt", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("link", { name: /^Đã xoá gần đây/ }).click();
  await expect(page.getByRole("heading", { name: "Đã xoá gần đây", level: 1 })).toBeVisible();
});

When("tôi khôi phục {string}", async ({ page }, text: string) => {
  await pickOnRow(page, text, "Khôi phục");
});

// Waits for the delete's own toast, shown once the server has answered, so the trash opened next already holds it. Any
// POST would not do: a note just saved asks for its reading too.
When(
  "tôi ghi rồi xoá ghi chú riêng {string}",
  async ({ page, today, remembered }, text: string) => {
    const own = ownName(remembered, text);
    await today.open();
    await today.record(own);
    await today.expectSaved(today.note(own));
    await today.remove(own);
    await expect(
      page.getByRole("dialog", { name: "Đã xoá ghi chú" }).filter({ hasText: own }),
    ).toBeVisible();
  },
);

When("tôi xoá vĩnh viễn ghi chú riêng {string}", async ({ page, remembered }, text: string) => {
  await pickOnRow(page, ownName(remembered, text), "Xoá vĩnh viễn");
  await answer(page, "Xoá vĩnh viễn mục này?", "Xoá vĩnh viễn");
});

Then(
  "Đã xoá gần đây không còn ghi chú riêng {string}",
  async ({ page, remembered }, text: string) => {
    await expect(
      page.getByRole("main").getByText(ownName(remembered, text), { exact: true }),
    ).toHaveCount(0);
  },
);

When(
  "tôi chọn các ghi chú riêng {string} và {string}",
  async ({ page, remembered }, first: string, second: string) => {
    await page.getByRole("button", { name: "Chọn", exact: true }).click();
    for (const text of [first, second]) {
      await page
        .getByRole("checkbox", { name: new RegExp(escaped(ownName(remembered, text))) })
        .check();
    }
    await expect(page.getByRole("heading", { name: "Đã chọn 2", level: 1 })).toBeVisible();
  },
);

Then("ghi chú riêng {string} hiện trong hôm nay", async ({ today, remembered }, text: string) => {
  await today.open();
  await today.expectSaved(today.note(ownName(remembered, text)));
});

// The question a delete asks first ("tôi được hỏi" is in settings.steps.ts), and its answer. A toast is a dialog
// too, so the question is the dialog holding the words or the answer.
Then("câu hỏi có nói {string}", async ({ page }, words: string) => {
  await expect(page.getByRole("dialog").filter({ hasText: words })).toBeVisible();
});

When("tôi trả lời {string}", async ({ page }, verb: string) => {
  const question = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("button", { name: verb, exact: true }) });
  await question.getByRole("button", { name: verb, exact: true }).click();
  await expect(question).toBeHidden();
});

Then(
  "trong Đã xoá gần đây khách {string} có dòng {string}",
  async ({ page, remembered }, name: string, words: string) => {
    await expect(
      page
        .getByRole("main")
        .getByRole("listitem")
        .filter({ has: page.getByText(ownName(remembered, name), { exact: true }) }),
    ).toContainText(words);
  },
);

When("tôi khôi phục khách {string}", async ({ page, remembered }, name: string) => {
  await pickOnRow(page, ownName(remembered, name), "Khôi phục");
});
