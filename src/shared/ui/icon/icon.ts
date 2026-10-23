import type { ComponentProps, ReactElement } from "react";

export type IconProps = Omit<ComponentProps<"svg">, "children" | "viewBox"> & {
  // Solid instead of outlined: the current tab, the glyph on a row's coloured tile
  readonly filled?: boolean;
};

// Any of the app's icons, passed to a button, a row or a tab to draw
export type Icon = (props: IconProps) => ReactElement;
