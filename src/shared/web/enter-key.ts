export type Device = "desktop" | "phone";

export type EnterKeyPress = {
  readonly key: string;
  readonly shiftKey: boolean;
  // True while an input method is still building a character, as Vietnamese input often is
  readonly isComposing: boolean;
};

// Desktop: Enter sends and Shift+Enter is a new line, as in Telegram Desktop.
// Phone: Enter is always a new line and the button sends, as in Telegram and Zalo on a phone.
export function enterSends(press: EnterKeyPress, device: Device): boolean {
  return press.key === "Enter" && !press.shiftKey && !press.isComposing && device === "desktop";
}

// A fine pointer that can hover means a mouse or trackpad, so a real keyboard is likely
export function currentDevice(): Device {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches ? "desktop" : "phone";
}
