import { expect, type Page } from "@playwright/test";

import { Given, Then, When } from "./fixtures";

const serviceWorker = "/sw.js";

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
