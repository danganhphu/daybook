import { useEffect, useState } from "react";

// Fields that bring up a phone's keyboard; a date, a checkbox or a button does not
const keyboardInputTypes = new Set(["text", "search", "tel", "url", "email", "password", "number"]);

// For a press that never ends in a click
const clickWait = 300;

function hasKeyboard(element: Element | null): boolean {
  return (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement && keyboardInputTypes.has(element.type))
  );
}

// True from the moment a text field takes focus. When a tap takes focus away, false right after that tap's click, the
// next frame: earlier would move the page between pressing a button at its foot and its click (W3C Touch Events: a
// tap's mouse events land where the page is then), later would move what the tap opened, a menu, under the next tap.
export function useTyping(): boolean {
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let pressing = false;
    let waiting: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;

    const settle = () => {
      clearTimeout(waiting);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTyping(hasKeyboard(document.activeElement)));
    };

    const update = () => {
      clearTimeout(waiting);
      cancelAnimationFrame(frame);
      if (hasKeyboard(document.activeElement)) {
        setTyping(true);
      } else if (pressing) {
        waiting = setTimeout(settle, clickWait);
      } else {
        settle();
      }
    };

    const press = () => {
      pressing = true;
    };
    const release = () => {
      if (pressing) {
        pressing = false;
        settle();
      }
    };

    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    document.addEventListener("pointerdown", press, true);
    document.addEventListener("click", release, true);
    document.addEventListener("pointercancel", release, true);
    return () => {
      clearTimeout(waiting);
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("click", release, true);
      document.removeEventListener("pointercancel", release, true);
    };
  }, []);

  return typing;
}
