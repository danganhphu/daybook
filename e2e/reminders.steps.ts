import { expect, type Page } from "@playwright/test";
import { Temporal } from "temporal-polyfill/implementation";

import { vietnamDate } from "@/shared/domain/vietnam-day";

import { Given, Then, When } from "./fixtures";

// Reminders, found by role and by the words on screen

const title = "Việc cần nhắc";

function reminderRow(page: Page, text: string) {
  return page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ has: page.getByText(text, { exact: true }) });
}

async function openReminders(page: Page) {
  await page.goto("/reminders");
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
}

// Fills the open form and saves; `day` is a quick choice ("Hôm nay", "Ngày mai") or YYYY-MM-DD
async function saveForm(page: Page, text: string | undefined, day: string) {
  // A toast is a dialog too, so the form is found by its exact title
  const dialog = page.getByRole("dialog", { name: "Thêm việc cần nhắc", exact: true });
  if (text !== undefined) {
    await dialog.getByRole("textbox", { name: title }).fill(text);
  }
  if (day === "Hôm nay" || day === "Ngày mai") {
    await dialog.getByRole("button", { name: day, exact: true }).click();
  } else {
    await dialog.getByLabel("Ngày nhắc").fill(day);
  }
  await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function addOnRemindersPage(page: Page, text: string, day: string) {
  await openReminders(page);
  await page.getByRole("button", { name: "Thêm việc cần nhắc" }).first().click();
  await saveForm(page, text, day);
}

function daysFromToday(days: number): string {
  return vietnamDate(Temporal.Now.instant()).add({ days }).toString();
}

// Deletes every open reminder through the screen, waiting for each answer, then reloads so no toast is left over
Given("chưa có việc cần nhắc nào", async ({ page }) => {
  await openReminders(page);
  const menus = page.getByRole("main").getByRole("button", { name: /^Tuỳ chọn cho việc/ });
  for (let left = await menus.count(); left > 0; left -= 1) {
    await menus.first().click();
    const answered = page.waitForResponse((response) => response.request().method() === "POST");
    await page.getByRole("menuitem", { name: "Xoá" }).click();
    await answered;
    await expect(menus).toHaveCount(left - 1);
  }
  await openReminders(page);
});

Given("có việc cần nhắc {string} cho hôm nay", async ({ page }, text: string) => {
  await addOnRemindersPage(page, text, "Hôm nay");
});

When("tôi thêm việc cần nhắc {string} cho hôm nay", async ({ page }, text: string) => {
  await addOnRemindersPage(page, text, "Hôm nay");
});

When(
  "tôi thêm việc cần nhắc {string} hạn {int} ngày trước",
  async ({ page }, text: string, days: number) => {
    await addOnRemindersPage(page, text, daysFromToday(-days));
  },
);

When(
  "tôi thêm việc cần nhắc {string} cho hôm nay, gõ {string} rồi chọn khách {string}",
  async ({ page }, text: string, typed: string, customer: string) => {
    await openReminders(page);
    await page.getByRole("button", { name: "Thêm việc cần nhắc" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Thêm việc cần nhắc", exact: true });
    await dialog.getByRole("combobox", { name: "Khách" }).fill(typed);
    await page.getByRole("option", { name: new RegExp(customer) }).click();
    await saveForm(page, text, "Hôm nay");
  },
);

When("tôi mở trang Việc cần nhắc", async ({ page }) => {
  await openReminders(page);
});

When("tôi mở trang khách {string}", async ({ page }, name: string) => {
  await page.goto("/customers");
  await page
    .getByRole("link")
    .filter({ has: page.getByText(name, { exact: true }) })
    .first()
    .click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
});

When(
  "tôi thêm việc cần nhắc {string} ở trang khách cho ngày mai",
  async ({ page }, text: string) => {
    await page.getByRole("button", { name: "Thêm việc cần nhắc" }).click();
    await saveForm(page, text, "Ngày mai");
  },
);

When("tôi nhắc việc từ ghi chú {string} cho ngày mai", async ({ page, today }, text: string) => {
  await today
    .note(text)
    .getByRole("button", { name: /^Tuỳ chọn/ })
    .click();
  await page.getByRole("menuitem", { name: "Nhắc việc này" }).click();
  await saveForm(page, undefined, "Ngày mai");
});

When("tôi đánh dấu xong việc {string}", async ({ page }, text: string) => {
  await page
    .getByRole("button", { name: `Xong: ${text}`, exact: true })
    .first()
    .click();
});

Then("có việc {string} trong nhóm {string}", async ({ page }, text: string, group: string) => {
  await expect(page.getByRole("heading", { name: group, exact: true, level: 2 })).toBeVisible();
  await expect(reminderRow(page, text)).toBeVisible();
});

Then("không còn việc {string}", async ({ page }, text: string) => {
  await expect(reminderRow(page, text)).toHaveCount(0);
});

Then("việc {string} ghi {string}", async ({ page }, text: string, due: string) => {
  await expect(reminderRow(page, text)).toContainText(due);
});

Then("Hôm nay nhắc {string}", async ({ page }, text: string) => {
  await expect(page.getByRole("region", { name: title })).toContainText(text);
});

When("tôi xem việc đã xong", async ({ page }) => {
  await openReminders(page);
  const chip = page.getByRole("link", { name: "Đã xong", exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-current", "page");
});

// Other runs on the same book may have finished one of the same words; any of them will do
Then("có việc đã xong {string}", async ({ page }, text: string) => {
  await expect(reminderRow(page, text).first()).toContainText("Xong");
});

When("tôi mở lại việc {string}", async ({ page }, text: string) => {
  await reminderRow(page, text)
    .first()
    .getByRole("button", { name: "Mở lại", exact: true })
    .click();
});
