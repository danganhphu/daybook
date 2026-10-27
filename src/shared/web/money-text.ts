import { parseMoney, type Money } from "@/shared/domain/money";

// Money as people write it here: dots between thousands and đ stuck to the end, "850.000đ". Grouped by hand rather than
// by Intl, since the Worker's ICU and a browser's do not always agree on Vietnamese formats.
export function moneyText(amount: number): string {
  const digits = String(Math.trunc(Math.abs(amount)));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${amount < 0 ? "-" : ""}${grouped}đ`;
}

const compactScales = [
  { size: 1_000_000_000, suffix: " tỷ" },
  { size: 1_000_000, suffix: "tr" },
  { size: 1_000, suffix: "k" },
] as const;

// Money short enough for a chart's axis, as people say it: "500k", "2,5tr", "1,2 tỷ". Meant for round values; one
// decimal at most.
export function compactMoneyText(amount: number): string {
  const scale = compactScales.find((each) => Math.abs(amount) >= each.size);
  if (scale === undefined) {
    return amount === 0 ? "0" : moneyText(amount);
  }

  return `${String(Math.round((amount / scale.size) * 10) / 10).replace(".", ",")}${scale.suffix}`;
}

// The digits of what was typed into a money field: "850.000", "850 000" and "850,000đ" are all 850000. Undefined when
// there are none, or the number is not money.
export function parseMoneyInput(text: string): Money | undefined {
  const digits = text.replace(/[\s.,đ₫]/gu, "");
  if (!/^\d{1,13}$/.test(digits)) {
    return undefined;
  }

  const parsed = parseMoney(Number(digits));

  return parsed.ok ? parsed.value : undefined;
}

// What a money field shows once left: the digits grouped, without the đ that sits beside the field
export function groupedDigits(amount: number): string {
  return moneyText(amount).slice(0, -1);
}
