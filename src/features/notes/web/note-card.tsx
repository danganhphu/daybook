import type { NoteView } from "./note-view";

import styles from "./note-card.module.scss";

// A note to read, not to change: a search result, or a note shown beside something else
export function NoteCard({ note }: { readonly note: NoteView }) {
  return (
    <li className={styles.card}>
      <p className={styles.content}>{note.content}</p>
      <time className={styles.time} dateTime={note.createdAt}>
        {note.time}
      </time>
    </li>
  );
}
