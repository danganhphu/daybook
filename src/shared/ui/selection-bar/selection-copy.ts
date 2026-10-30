// What every list being chosen from says, the same on each screen
export const selectionCopy = {
  choose: "Chọn",
  chooseAll: "Chọn tất cả",
} as const;

// The header while choosing: "Đã chọn 3", or what to do before anything is
export function chosenTitle(count: number): string {
  return count === 0 ? "Chọn mục" : `Đã chọn ${count}`;
}
