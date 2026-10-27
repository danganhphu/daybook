import { ArrowDownwardIcon, ArrowUpwardIcon } from "@/shared/ui/icon/icons";

import styles from "./stats.module.scss";

export type StatChange = {
  readonly text: string;
  // Up is good news and down bad, in colour; the sign in the text and the arrow say it too
  readonly direction: "up" | "down" | "flat";
};

export type Stat = {
  readonly label: string;
  readonly value: string;
  // Danger draws the eye to a number that needs doing something about, such as a debt
  readonly tone?: "neutral" | "danger";
  // Against an earlier one: "+12% so với tháng trước"
  readonly change?: StatChange | undefined;
};

export type StatsProps = {
  readonly label: string;
  // The screen's one big number, above the rest
  readonly hero?: Stat | undefined;
  readonly items: ReadonlyArray<Stat>;
};

function Change({ change }: { readonly change: StatChange | undefined }) {
  if (change === undefined) {
    return null;
  }
  const Arrow = { up: ArrowUpwardIcon, down: ArrowDownwardIcon, flat: undefined }[change.direction];

  return (
    <dd className={styles.change} data-direction={change.direction}>
      {Arrow === undefined ? null : <Arrow aria-hidden />}
      {change.text}
    </dd>
  );
}

// A few numbers in one card, each a small label over a large value
export function Stats({ label, hero, items }: StatsProps) {
  return (
    <dl className={styles.stats} aria-label={label}>
      {hero === undefined ? null : (
        <div className={styles.hero}>
          <dt className={styles.label}>{hero.label}</dt>
          <dd className={styles.heroValue}>{hero.value}</dd>
          <Change change={hero.change} />
        </div>
      )}
      {items.map((item) => (
        <div key={item.label} className={styles.stat}>
          <dt className={styles.label}>{item.label}</dt>
          <dd className={styles.value} data-tone={item.tone ?? "neutral"}>
            {item.value}
          </dd>
          <Change change={item.change} />
        </div>
      ))}
    </dl>
  );
}
