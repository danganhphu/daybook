import { moneySchema, type Money } from "@/shared/domain/money";
import { searchText } from "@/shared/domain/search-text";

// Money as the trade writes it: "500k", "85 nghìn", "1tr2" (1.200.000), "2tr5", "6 triệu", "2 củ", "1,5tr",
// "1.200.000đ". Undefined when the words hold no amount, or one past what money holds.
export function moneyWords(written: string): Money | undefined {
  const words = searchText(written).replaceAll(",", ".");

  const millions = /(\d+(?:\.\d+)?)\s*(?:tr|trieu|cu)\s*(\d*)/.exec(words);
  if (millions !== null) {
    const [, whole = "0", tail = ""] = millions;
    return money((Number(whole) + (tail === "" ? 0 : Number(`0.${tail}`))) * 1_000_000);
  }

  const thousands = /(\d+(?:\.\d+)?)\s*(?:k|nghin|ngan)\b/.exec(words);
  if (thousands !== null) {
    return money(Number(thousands[1]) * 1_000);
  }

  const plain = /(\d{1,3}(?:\.\d{3})+|\d+)/.exec(words);

  return plain === null ? undefined : money(Number(plain[1]?.replaceAll(".", "")));
}

function money(amount: number): Money | undefined {
  const parsed = moneySchema.safeParse(Math.round(amount));

  return parsed.success ? parsed.data : undefined;
}
