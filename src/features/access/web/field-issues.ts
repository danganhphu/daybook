// The sentence for a field the schema refused: the schema's own first message, or a plain one when it gave none
export const fieldFallbacks = {
  displayName: "Tên không hợp lệ",
  username: "Tên đăng nhập không hợp lệ",
} as const;

export function firstIssue(
  error: { readonly issues: ReadonlyArray<{ readonly message: string }> },
  fallback: string,
): string {
  return error.issues[0]?.message ?? fallback;
}
