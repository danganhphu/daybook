import { expect, type Locator, type Page } from "@playwright/test";

export type TodayPage = ReturnType<typeof todayPage>;

// Shown is not saved: a row stays aria-busy until the server has confirmed the change
async function expectSaved(row: Locator) {
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("aria-busy", "false");
}

// The today screen as the user sees it: found by role and by the words on screen, never by class names
export function todayPage(page: Page) {
  const box = page.getByRole("textbox", { name: "Ghi chú mới" });
  const send = page.getByRole("button", { name: "Ghi", exact: true });
  const notes = page.getByRole("listitem");
  const emptyDay = page.getByRole("heading", { name: "Hôm nay chưa có ghi chú nào" });

  function note(text: string) {
    return notes.filter({ has: page.getByText(text, { exact: true }) });
  }

  async function open() {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Hôm nay", level: 1 })).toBeVisible();
  }

  async function openMenu(text: string) {
    await note(text)
      .getByRole("button", { name: /^Tuỳ chọn/ })
      .click();
  }

  return {
    page,
    box,
    send,
    notes,
    emptyDay,
    note,
    open,
    expectSaved,

    // Deletes whatever today holds through the screen itself, then reloads so no toast is left over. The row leaves
    // the screen before the server is done, so each delete waits for the server action's answer, or the reload
    // could still find the note.
    async clear() {
      await open();
      for (let left = await notes.count(); left > 0; left -= 1) {
        await notes
          .first()
          .getByRole("button", { name: /^Tuỳ chọn/ })
          .click();
        const answered = page.waitForResponse((response) => response.request().method() === "POST");
        await page.getByRole("menuitem", { name: "Xoá" }).click();
        await answered;
        await expect(notes).toHaveCount(left - 1);
      }
      await open();
      await expect(emptyDay).toBeVisible();
    },

    async record(text: string) {
      await box.fill(text);
      await send.click();
    },

    async edit(from: string, to: string) {
      await openMenu(from);
      await page.getByRole("menuitem", { name: "Sửa" }).click();
      await page.getByRole("textbox", { name: "Sửa ghi chú" }).fill(to);
      await page.getByRole("button", { name: "Lưu" }).click();
    },

    async remove(text: string) {
      await openMenu(text);
      await page.getByRole("menuitem", { name: "Xoá" }).click();
    },
  };
}
