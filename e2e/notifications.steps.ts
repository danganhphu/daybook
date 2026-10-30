import { readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { expect, type Page } from "@playwright/test";
import { v7 as uuidv7 } from "uuid";

import { answer } from "./confirm";
import { Given, Then, When } from "./fixtures";
import { ownName } from "./own-names";
import { databaseFolder } from "./paths";

const serviceWorker = "/sw.js";
const bell = /^Thông báo(, \d+ chưa đọc)?$/;

// What the queue's consumer would keep for Lan, written straight into the run's database: no cron runs here. Each
// scenario's own, so a run on another device finds one of its own unread.
function tellLan(title: string) {
  const file = readdirSync(databaseFolder).find(
    (name) => name.endsWith(".sqlite") && name !== "metadata.sqlite",
  );
  // The server has the file open too: wait for its lock rather than fail on it
  const db = new DatabaseSync(join(databaseFolder, file ?? ""), { timeout: 5000 });
  try {
    db.prepare(
      "insert into inbox_item (id, account_id, subject, ref, title, body, path, created_at, read_at) select ?, id, 'notice', ?, ?, '', '/settings/notifications', ?, null from account where username = 'lan'",
    ).run(uuidv7(), uuidv7(), title, Date.now());
  } finally {
    db.close();
  }
}

Given("tôi có một thông báo mới {string}", async ({ page }, title: string) => {
  tellLan(title);
  await page.goto("/");
});

Given("tôi có một thông báo mới riêng {string}", async ({ page, remembered }, title: string) => {
  tellLan(ownName(remembered, title));
  await page.goto("/");
});

When("tôi xoá thông báo riêng {string}", async ({ page, remembered }, title: string) => {
  await page.getByRole("button", { name: "Chọn", exact: true }).click();
  await page.getByRole("checkbox", { name: new RegExp(ownName(remembered, title)) }).check();
  await page.getByRole("button", { name: "Xoá", exact: true }).click();
  await answer(page, "Xoá thông báo này?", "Xoá");
});

Then(
  "cái chuông không còn thông báo riêng {string}",
  async ({ page, remembered }, title: string) => {
    await expect(
      page.getByRole("main").getByText(ownName(remembered, title), { exact: true }),
    ).toHaveCount(0);
  },
);

Then("cái chuông báo có thông báo chưa đọc", async ({ page }) => {
  await expect(page.getByRole("link", { name: /^Thông báo, \d+ chưa đọc$/ })).toBeVisible();
});

When("tôi mở cái chuông", async ({ page }) => {
  await page.getByRole("link", { name: bell }).click();
  await expect(page.getByRole("heading", { name: "Thông báo", level: 1 })).toBeVisible();
});

Then("thông báo {string} đang tô là chưa đọc", async ({ page }, title: string) => {
  await expect(page.getByRole("link", { name: new RegExp(`^Chưa đọc: ${title}`) })).toBeVisible();
});

// The list is marked read by a request of its own once on screen, so the bell may need a moment. Back on a tab first:
// reloading before the way back has finished would reload the list itself.
Then("cái chuông không còn số chưa đọc", async ({ page }) => {
  await expect(page.getByRole("link", { name: bell })).toBeVisible();
  await expect
    .poll(async () => {
      await page.reload();
      return page.getByRole("link", { name: bell }).getAttribute("aria-label");
    })
    .toBe("Thông báo");
});

When("tôi chọn {string} cho {string}", async ({ page }, choice: string, label: string) => {
  const field = page.getByLabel(label, { exact: true });
  await expect(field).toBeEnabled();
  await field.selectOption({ label: choice });
});

When("tôi mở lại màn này", async ({ page }) => {
  await page.reload();
});

Then("{string} đang là {string}", async ({ page }, label: string, choice: string) => {
  await expect(page.getByLabel(label, { exact: true })).toHaveValue(choice);
});

// As the app registers it when notifications are turned on, the person having allowed them: without that, the
// service worker's showNotification is refused
Given("trình duyệt này đã cài phần nhận thông báo của app", async ({ page, baseURL }) => {
  await page.context().grantPermissions(["notifications"], { origin: baseURL ?? "" });
  await page.goto("/");
  const scope = await page.evaluate(async (url) => {
    const registration = await navigator.serviceWorker.register(url, { scope: "/" });
    await navigator.serviceWorker.ready;
    return registration.scope;
  }, serviceWorker);
  expect(new URL(scope).pathname).toBe("/");
});

async function workerRegistration(page: Page) {
  const session = await page.context().newCDPSession(page);
  const found = new Promise<string>((resolve) => {
    session.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
      const ours = registrations.find((registration) => !registration.isDeleted);
      if (ours !== undefined) {
        resolve(ours.registrationId);
      }
    });
  });
  await session.send("ServiceWorker.enable");

  return { session, registrationId: await found };
}

When("app gửi tới trình duyệt này {string}", async ({ page }, title: string) => {
  const { session, registrationId } = await workerRegistration(page);
  await session.send("ServiceWorker.deliverPushMessage", {
    origin: new URL(page.url()).origin,
    registrationId,
    data: JSON.stringify({
      title,
      body: "Gọi lại Nha khoa Minh Châu",
      tag: "morning-e2e",
      path: "/",
    }),
  });
});

Then("trình duyệt hiện thông báo {string}", async ({ page }, title: string) => {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        return (await registration.getNotifications()).map((notification) => notification.title);
      }),
    )
    .toContain(title);
});
