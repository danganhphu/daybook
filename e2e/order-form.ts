import { expect, type Page } from "@playwright/test";

// A line as a scenario's table writes it
export type LineRow = Readonly<Record<string, string>>;

// Fills the order form's lines (sản phẩm, số lượng, đơn giá), then saves and waits for the order's page
export async function fillLinesAndSave(page: Page, rows: ReadonlyArray<LineRow>) {
  // The product field is built once the page has hydrated; it is disabled until then
  await expect(page.getByRole("combobox", { name: "Sản phẩm 1" })).toBeEnabled();

  for (const [index, row] of rows.entries()) {
    if (index > 0) {
      await page.getByRole("button", { name: "Thêm sản phẩm" }).click();
    }
    await page.getByRole("combobox", { name: `Sản phẩm ${index + 1}` }).fill(row["sản phẩm"] ?? "");
    await page
      .getByRole("textbox", { name: "Số lượng" })
      .nth(index)
      .fill(row["số lượng"] ?? "");
    await page
      .getByRole("textbox", { name: "Đơn giá (đ)" })
      .nth(index)
      .fill(row["đơn giá"] ?? "");
  }
  await page.getByRole("button", { name: "Lưu đơn" }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
}
