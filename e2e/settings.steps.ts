import { expect, type Page } from "@playwright/test";

import { giveFaceId } from "./face-id";
import { Given, Then, When } from "./fixtures";

// A row of a settings list, found by what it shows
function row(page: Page, text: string) {
  return page.getByRole("listitem").filter({ has: page.getByText(text, { exact: true }) });
}

// The button that opens a value for editing: "Sửa tên", "Sửa tên đăng nhập"
function editButton(page: Page, label: string) {
  return page.getByRole("button", { name: `Sửa ${label.toLocaleLowerCase("vi")}`, exact: true });
}

Given("tôi đã đăng nhập từ lâu", async ({ access }) => {
  await access.signInLongAgo();
});

Given("máy này có Face ID của Hoa", async ({ page, access }) => {
  await giveFaceId(page, access.hoaPasskey);
});

Given("Hoa đã đăng nhập từ lâu", async ({ access }) => {
  await access.signInAsHoaLongAgo();
});

// The breach check runs in the browser against Have I Been Pwned; the run answers for it, with only padding lines,
// so it never depends on someone else's service
Given("mật khẩu nào cũng chưa từng bị lộ", async ({ page }) => {
  await page.route("https://api.pwnedpasswords.com/range/*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/plain",
      headers: { "access-control-allow-origin": "*" },
      body: "0000000000000000000000000000000000A:0\r\n",
    }),
  );
});

When("tôi mở Cài đặt", async ({ page }) => {
  await openSettingsFrom(page, "/");
});

When("tôi mở Cài đặt từ tab {string}", async ({ page }, tab: string) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Mục chính" })
    .getByRole("link", { name: tab })
    .click();
  await expect(page.getByRole("heading", { name: tab, level: 1 })).toBeVisible();
  await openSettingsFrom(page, undefined);
});

// A row of the overview opens the screen of the same name
When("tôi mở {string} trong Cài đặt", async ({ page }, section: string) => {
  await page.getByRole("link", { name: new RegExp(`^${section}`) }).click();
  await expect(page.getByRole("heading", { name: section, level: 1 })).toBeVisible();
});

When("tôi bấm quay lại", async ({ page }) => {
  await page.getByRole("link", { name: "Quay lại", exact: true }).click();
});

Then("tôi thấy tiêu đề {string}", async ({ page }, title: string) => {
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
});

async function openSettingsFrom(page: Page, path: string | undefined) {
  if (path !== undefined) {
    await page.goto(path);
  }
  await page.getByRole("button", { name: "Tài khoản", exact: true }).click();
  await page.getByRole("menuitem", { name: "Cài đặt" }).click();
  await expect(page).toHaveURL(/\/settings(\?|$)/);
  await expect(page.getByRole("heading", { name: "Cài đặt", level: 1 })).toBeVisible();
}

When("tôi sửa {string} thành {string}", async ({ page }, label: string, value: string) => {
  await editButton(page, label).click();
  await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
});

When("tôi bắt đầu sửa {string} rồi nhấn Esc", async ({ page }, label: string) => {
  await editButton(page, label).click();
  const field = page.getByRole("textbox", { name: label, exact: true });
  await expect(field).toBeFocused();
  await field.fill("không lưu cái này");
  await field.press("Escape");
});

Then("nút {string} đang được chọn", async ({ page }, name: string) => {
  await expect(page.getByRole("button", { name, exact: true })).toBeFocused();
});

Then("tôi được hỏi {string}", async ({ page }, title: string) => {
  await expect(page.getByRole("dialog", { name: title })).toBeVisible();
});

When("tôi xác nhận bằng mật khẩu của Lan", async ({ page, access }) => {
  const dialog = page.getByRole("dialog", { name: "Xác nhận lại" });
  await dialog.getByLabel("Mật khẩu", { exact: true }).fill(access.lanPassword);
  await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(dialog).toBeHidden();
});

// The dialog answers while the change that asked is still waiting on it
When("tôi xác nhận bằng mật khẩu sai thì được báo sai ngay", async ({ page }) => {
  const dialog = page.getByRole("dialog", { name: "Xác nhận lại" });
  await dialog.getByLabel("Mật khẩu", { exact: true }).fill("không phải mật khẩu của Lan");
  await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Sai tên đăng nhập hoặc mật khẩu.");
  await expect(dialog.getByRole("button", { name: "Xác nhận", exact: true })).toBeEnabled();
});

When("tôi xác nhận bằng Face ID", async ({ page }) => {
  const dialog = page.getByRole("dialog", { name: "Xác nhận lại" });
  await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(dialog).toBeHidden();
});

// "Đặt" the first time, "Đổi" when an earlier run already set one
When("tôi đặt mật khẩu dự phòng {string}", async ({ page }, password: string) => {
  await row(page, "Mật khẩu dự phòng")
    .getByRole("button", { name: /^(Đặt|Đổi)$/ })
    .click();
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
});

Then("mật khẩu dự phòng đã được lưu", async ({ page }) => {
  await expect(
    page.getByRole("dialog", { name: /^Đã (đặt|đổi) mật khẩu dự phòng$/ }),
  ).toBeVisible();
});

When("tôi đăng xuất từ Cài đặt", async ({ page }) => {
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
});

When(
  "tôi đăng nhập bằng {string} và mật khẩu {string}",
  async ({ page }, username: string, password: string) => {
    await page.getByRole("button", { name: "Dùng mật khẩu", exact: true }).click();
    await page.getByLabel("Tên đăng nhập", { exact: true }).fill(username);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  },
);
