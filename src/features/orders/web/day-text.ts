// "24/10" from "2026-10-24", for a day inside a sentence; the year is clear from the order around it
export function shortDay(day: string): string {
  const [, month, date] = day.split("-");

  return `${Number(date)}/${Number(month)}`;
}

// "Tháng 10/2026" from "2026-10"
export function monthLabel(month: string): string {
  const [year, number] = month.split("-");

  return `Tháng ${Number(number)}/${year}`;
}
