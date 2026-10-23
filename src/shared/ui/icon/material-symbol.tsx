import type { IconProps } from "./icon";

type MaterialSymbolProps = IconProps & {
  readonly outlinePath: string;
  // Absent where the symbol has no filled form, such as an arrow
  readonly filledPath?: string;
};

// One Material Symbol on its 24-unit grid, in the text colour and sized by the CSS around it. Decoration unless the
// caller says otherwise: the button or row it sits in carries the name.
export function MaterialSymbol({
  outlinePath,
  filledPath = outlinePath,
  filled = false,
  ...props
}: MaterialSymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden {...props}>
      <path d={filled ? filledPath : outlinePath} />
    </svg>
  );
}
