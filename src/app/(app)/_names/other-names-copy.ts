// What the other-names card says, on a customer's page and a product's alike
export const otherNamesCopy = {
  title: "Tên khác",
  add: "Thêm tên khác",
  name: "Tên khác",
  added: "Đã thêm tên",
  removed: "Đã bỏ tên",
} as const;

export function removeName(name: string): string {
  return `Bỏ tên "${name}"`;
}
