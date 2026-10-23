import styles from "./stats.module.scss";

export type Stat = {
  readonly label: string;
  readonly value: string;
  // Danger draws the eye to a number that needs doing something about, such as a debt
  readonly tone?: "neutral" | "danger";
};

export type StatsProps = {
  readonly label: string;
  // The screen's one big number, in green above the rest, as ColorOS shows "1,68 GB có thể dọn dẹp"
  readonly hero?: Stat | undefined;
  readonly items: ReadonlyArray<Stat>;
};

// A few numbers in one card, each a small label over a large value, as a banking app's summary
export function Stats({ label, hero, items }: StatsProps) {
  return (
    <dl className={styles.stats} aria-label={label}>
      {hero === undefined ? null : (
        <div className={styles.hero}>
          <dt className={styles.label}>{hero.label}</dt>
          <dd className={styles.heroValue}>{hero.value}</dd>
        </div>
      )}
      {items.map((item) => (
        <div key={item.label} className={styles.stat}>
          <dt className={styles.label}>{item.label}</dt>
          <dd className={styles.value} data-tone={item.tone ?? "neutral"}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
