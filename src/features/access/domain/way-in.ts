import type { Passkey } from "./passkey";
import * as Passwords from "./password";
import type { Password } from "./password";

// Two people share one book (ADR 0009). An invite past that is refused: a third account would read and change the whole
// book. The operator's command can still add one.
export const bookPeople = 2;

// Someone can sign in: a passkey, or a password not locked
export function hasWayIn(
  passkeys: ReadonlyArray<Passkey>,
  password: Password | undefined,
): boolean {
  return passkeys.length > 0 || (password !== undefined && !Passwords.isLocked(password));
}
