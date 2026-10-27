import { describe, expect, it, vi } from "vitest";

import { beginNavigation, isNavigating, subscribeToNavigations } from "./navigation-pending";

describe("navigations under way", () => {
  it("given a navigation, when it begins and ends, then the bar is told both times", () => {
    const told = vi.fn<() => void>();
    const unsubscribe = subscribeToNavigations(told);

    const end = beginNavigation();
    expect(isNavigating()).toBe(true);
    end();
    expect(isNavigating()).toBe(false);
    expect(told).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("given two links, when the first one's navigation ends, then the other is still under way", () => {
    const endFirst = beginNavigation();
    const endSecond = beginNavigation();

    endFirst();
    expect(isNavigating()).toBe(true);
    endSecond();
    expect(isNavigating()).toBe(false);
  });

  it("given a navigation ended twice, as a link that unmounts after it ends, when counted, then it counts once", () => {
    const endKept = beginNavigation();
    const endTwice = beginNavigation();

    endTwice();
    endTwice();
    expect(isNavigating()).toBe(true);
    endKept();
    expect(isNavigating()).toBe(false);
  });
});
