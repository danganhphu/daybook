import styles from "./status.module.scss";

export type StatusProps = {
  // What happened last; nothing while all is well
  readonly message: string | undefined;
  // Danger when the message is a refusal the person has to act on
  readonly tone?: "muted" | "danger";
};

// One line for the outcome of an action. <output> is a live region: a new message is read out without moving focus.
export function Status({ message, tone = "muted" }: StatusProps) {
  return (
    <output className={styles.status} data-tone={tone}>
      {message}
    </output>
  );
}
