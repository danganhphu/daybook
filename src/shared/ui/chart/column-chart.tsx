"use client";

import { useCallback, useId, useRef, useState, type ChangeEvent, type PointerEvent } from "react";

import styles from "./column-chart.module.scss";

export type ChartColumn = {
  readonly key: string;
  // Under the column; left out on most columns of a long chart
  readonly axisLabel: string | undefined;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  // Percent of the axis
  readonly share: number;
};

export type ColumnChartProps = {
  readonly heading: string;
  readonly columns: ReadonlyArray<ChartColumn>;
  // The axis, read from its top line down to zero: three labels
  readonly ticks: readonly [string, string, string];
  // The column the readout shows until one is picked, and the word that says why
  readonly peak: number;
  readonly peakLabel: string;
  readonly tableLabel: string;
  readonly tableHeads: readonly [string, string, string];
};

const tickPlaces = ["top", "middle", "bottom"] as const;

// Columns over time, drawn in HTML: each column's height is a data-share step, so nothing needs a style attribute,
// which the CSP refuses. A finger or a mouse on the plot picks the column under it; the keyboard and screen readers
// move through the columns with a slider, the browser's own. A readout above says the picked column's label and
// value, and the table under it has every value.
export function ColumnChart({
  heading,
  columns,
  ticks,
  peak,
  peakLabel,
  tableLabel,
  tableHeads,
}: ColumnChartProps) {
  const [picked, setPicked] = useState<number>();
  const plot = useRef<DOMRect | undefined>(undefined);
  const headingId = useId();
  const last = columns.length - 1;
  const shown = picked ?? peak;
  const column = columns[shown];
  const label = column?.label ?? "";
  const value = `${column?.value ?? ""}, ${column?.detail ?? ""}`;

  const pickAt = useCallback(
    (clientX: number) => {
      const bounds = plot.current;
      if (bounds === undefined || bounds.width === 0) {
        return;
      }
      const index = Math.floor(((clientX - bounds.left) / bounds.width) * columns.length);
      setPicked(Math.min(last, Math.max(0, index)));
    },
    [columns.length, last],
  );

  // The plot is measured once as a pointer arrives, never while it moves
  const measure = useCallback((event: PointerEvent<HTMLDivElement>) => {
    plot.current = event.currentTarget.getBoundingClientRect();
  }, []);

  const press = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      measure(event);
      pickAt(event.clientX);
    },
    [measure, pickAt],
  );

  // A mouse picks as it moves; a finger only while it is down, dragging across
  const move = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" || event.buttons !== 0) {
        pickAt(event.clientX);
      }
    },
    [pickAt],
  );

  const leave = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") {
      setPicked(undefined);
    }
  }, []);

  const slide = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setPicked(Number(event.currentTarget.value));
  }, []);

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {heading}
      </h2>
      <div className={styles.card}>
        <p className={styles.readout} aria-hidden>
          <span className={styles.readoutLabel}>
            {picked === undefined ? `${peakLabel}: ${label}` : label}
          </span>
          <span className={styles.readoutValue}>{value}</span>
        </p>

        <div className={styles.frame} aria-hidden>
          <div className={styles.ticks}>
            {tickPlaces.map((place, index) => (
              <span key={place} className={styles.tick} data-place={place}>
                {ticks[index]}
              </span>
            ))}
          </div>
          <div
            className={styles.plot}
            onPointerEnter={measure}
            onPointerDown={press}
            onPointerMove={move}
            onPointerLeave={leave}
          >
            {tickPlaces.map((place) => (
              <span key={place} className={styles.gridline} data-place={place} />
            ))}
            <ol className={styles.columns}>
              {columns.map((each, index) => (
                <li
                  key={each.key}
                  className={styles.column}
                  data-picked={index === shown ? "" : undefined}
                >
                  <span className={styles.mark} data-share={each.share} />
                </li>
              ))}
            </ol>
          </div>
        </div>

        <ol className={styles.axis} aria-hidden>
          {columns.map((each) => (
            <li key={each.key}>{each.axisLabel}</li>
          ))}
        </ol>
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={last}
          step={1}
          value={shown}
          onChange={slide}
          aria-labelledby={headingId}
          aria-valuetext={`${label}: ${value}`}
        />

        <details>
          <summary className={styles.summary}>{tableLabel}</summary>
          <table className={styles.values}>
            <thead>
              <tr>
                {tableHeads.map((head) => (
                  <th key={head} scope="col">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map((each) => (
                <tr key={each.key}>
                  <th scope="row">{each.label}</th>
                  <td>{each.value}</td>
                  <td>{each.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </section>
  );
}
