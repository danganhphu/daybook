import { err, type Result } from "@/shared/domain/result";

export const faultMessage = "Chưa gửi được. Kiểm tra mạng rồi thử lại.";

// Calls a server action from the browser. A refusal (blank text, a note that is gone) already carries its sentence;
// a fault - no connection, a server error, a tab older than the last deploy - throws, and becomes one plain sentence.
export async function attempt<T>(
  call: () => Promise<Result<T, string>>,
): Promise<Result<T, string>> {
  try {
    return await call();
  } catch {
    return err(faultMessage);
  }
}
