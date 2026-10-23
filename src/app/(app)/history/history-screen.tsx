import Form from "next/form";
import Link from "next/link";

import type { SearchView } from "@/features/notes/web/commands";
import { NoteCard } from "@/features/notes/web/note-card";
import { notesCopy } from "@/features/notes/web/notes-copy";
import { searchTermMaxLength } from "@/shared/domain/search-text";
import { actionLabels } from "@/shared/ui/action-labels";
import { IconLink } from "@/shared/ui/button/icon-link";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { ArrowBackIcon, ChevronRightIcon } from "@/shared/ui/icon/icons";
import { SearchField } from "@/shared/ui/search-field/search-field";
import { routes, searchQueryParameter } from "@/shared/web/routes";

import styles from "./history-screen.module.scss";

// Every note ever written, found by its words: the box at the top, the notes below grouped by day, newest first.
// A day's heading opens that day, where its notes can be changed.
export function HistoryScreen({ view }: { readonly view: SearchView }) {
  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>{notesCopy.search}</h1>
      <header className={styles.header}>
        <IconLink icon={ArrowBackIcon} label={actionLabels.back} href={routes.today} />
        <search className={styles.search}>
          <Form action={routes.history}>
            <SearchField
              label={notesCopy.search}
              name={searchQueryParameter}
              defaultValue={view.query}
              placeholder={notesCopy.search}
              maxLength={searchTermMaxLength}
              autoComplete="off"
              // Opened only by tapping search, to type into; once searched, the keyboard leaves the results alone
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- the screen's one purpose, reached on purpose
              autoFocus={!view.searched}
            />
          </Form>
        </search>
      </header>

      {!view.searched ? (
        <EmptyState title={notesCopy.searchPrompt} description={notesCopy.searchHint} />
      ) : view.days.length === 0 ? (
        <EmptyState title={notesCopy.notFound} description={notesCopy.notFoundHint} />
      ) : (
        <div className={styles.results}>
          {view.days.map((day) => (
            <section key={day.day} className={styles.day} aria-labelledby={`day-${day.day}`}>
              <h2 id={`day-${day.day}`} className={styles.dayHeading}>
                {/* A prefetch per day found would render every one of them; only one gets opened */}
                <Link href={day.path} className={styles.dayLink} prefetch={false}>
                  {day.label}
                  <ChevronRightIcon aria-hidden className={styles.chevron} />
                </Link>
              </h2>
              <ol className={styles.list}>
                {day.notes.map((note) => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </ol>
            </section>
          ))}
          {view.more ? <p className={styles.more}>{notesCopy.moreFound}</p> : null}
        </div>
      )}
    </main>
  );
}
