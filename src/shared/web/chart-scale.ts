// The top of a chart's axis: the smallest of 1, 2, 4, 5 or 10 times a power of ten at or above the largest value, so
// the halfway line is a round number too. Zero when there is nothing to draw.
export function axisTop(largest: number): number {
  if (largest <= 0) {
    return 0;
  }
  const power = 10 ** Math.floor(Math.log10(largest));
  const step = [1, 2, 4, 5, 10].find((each) => each * power >= largest) ?? 10;

  return step * power;
}

// A mark's length in whole percent of its track (data-share), never 0 for something above zero so it does not vanish
export function shareOf(value: number, top: number): number {
  if (value <= 0 || top <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(1, Math.round((value / top) * 100)));
}

// Which columns of a chart over time carry an axis label: all of seven or fewer, else about seven evenly spread
export function labelStride(columns: number): number {
  const labels = 7;

  return columns <= labels ? 1 : Math.ceil(columns / labels);
}
