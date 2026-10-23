import { useEffect, useState } from "react";

// Fields that bring up a phone's keyboard; a date, a checkbox or a button does not
const keyboardInputTypes = new Set(["text", "search", "tel", "url", "email", "password", "number"]);

// Long enough for the tap that took focus away to finish: the keyboard is on its way down by then
const keyboardLeaveDelay = 300;

function hasKeyboard(element: Element | null): boolean {
  return (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement && keyboardInputTypes.has(element.type))
  );
}

// True from the moment a text field takes focus; false only a beat after it loses it. Hiding the tab bar at once is
// fine, but bringing it back at once would move the page between pressing a button at its foot and letting go, and
// the release would land elsewhere: Lưu tapped, nothing saved.
export function useTyping(): boolean {
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let leaving: ReturnType<typeof setTimeout> | undefined;

    const update = () => {
      clearTimeout(leaving);
      if (hasKeyboard(document.activeElement)) {
        setTyping(true);
        return;
      }
      leaving = setTimeout(
        () => setTyping(hasKeyboard(document.activeElement)),
        keyboardLeaveDelay,
      );
    };

    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      clearTimeout(leaving);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);

  return typing;
}
