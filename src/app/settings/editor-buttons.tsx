import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";

import styles from "./settings.module.scss";

// Cancel then save, at the end of the line, as the note editor has them
export function EditorButtons({
  pending,
  onCancel,
}: {
  readonly pending: boolean;
  readonly onCancel: () => void;
}) {
  return (
    <div className={styles.buttons}>
      <Button variant="quiet" onClick={onCancel}>
        {actionLabels.cancel}
      </Button>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? actionLabels.saving : actionLabels.save}
      </Button>
    </div>
  );
}
