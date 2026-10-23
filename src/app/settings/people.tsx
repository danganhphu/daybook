"use client";

import { useCallback, useMemo, useState, useTransition } from "react";

import { setupLinkLifetime } from "@/features/access/domain/access-policy";
import type { PersonRow } from "@/features/access/web/account-view";
import { problemMessage } from "@/features/access/web/attempt-setting";
import type { IssuedLinkView, SettingsResult } from "@/features/access/web/settings-commands";
import { optionsFor } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { KeyIcon, PersonAddIcon } from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListAction } from "@/shared/ui/list/list-action";
import { ListRow } from "@/shared/ui/list/list-row";

import { createInvite, createRecoveryLink } from "./actions";
import { LinkDialog, type IssuedLink } from "./link-dialog";
import { useOutcomeToast } from "./use-outcome-toast";
import type { StepUp } from "./use-step-up";

const validFor = `Link chỉ dùng được một lần, trong ${setupLinkLifetime.total("minutes")} phút.`;

const recoverLabel = "Tạo link khôi phục";

export type PeopleProps = {
  readonly people: ReadonlyArray<PersonRow>;
  readonly run: StepUp["run"];
};

// Everyone who shares the book, and the two things one can do for another: invite someone new, and send a way back
// in to someone who lost theirs. No roles: both users see and do the same here.
export function People({ people, run }: PeopleProps) {
  const tell = useOutcomeToast();
  const [working, startWorking] = useTransition();
  const [link, setLink] = useState<IssuedLink>();
  const [showing, setShowing] = useState(false);

  const issue = useCallback(
    (action: () => Promise<SettingsResult<IssuedLinkView>>, words: Omit<IssuedLink, "url">) => {
      startWorking(async () => {
        const issued = await run(action);
        if (!issued.ok) {
          tell(problemMessage(issued.error));
          return;
        }
        setLink({ ...words, url: issued.value.url });
        setShowing(true);
      });
    },
    [run, tell],
  );

  const invite = useCallback(
    () =>
      issue(() => createInvite(), {
        title: "Link mời",
        description: `Gửi link này cho người bạn muốn mời. ${validFor}`,
      }),
    [issue],
  );
  const recover = useCallback(
    (person: PersonRow) =>
      issue(() => createRecoveryLink(person.id), {
        title: `${recoverLabel} cho ${person.displayName}`,
        description: `Khi ${person.displayName} dùng link, các thiết bị khác của ${person.displayName} sẽ bị đăng xuất. ${validFor}`,
      }),
    [issue],
  );
  const hide = useCallback(() => setShowing(false), []);

  return (
    <>
      <List heading="Người dùng">
        {people.map((person) => (
          <PersonItem key={person.id} person={person} onRecover={recover} />
        ))}
        <ListAction
          label="Mời người dùng"
          icon={PersonAddIcon}
          disabled={working}
          onClick={invite}
        />
      </List>
      <LinkDialog open={showing} link={link} onClose={hide} />
    </>
  );
}

function PersonItem({
  person,
  onRecover,
}: {
  readonly person: PersonRow;
  readonly onRecover: (person: PersonRow) => void;
}) {
  const actions = useMemo<ReadonlyArray<MenuAction>>(
    () => [{ label: recoverLabel, icon: KeyIcon, onSelect: () => onRecover(person) }],
    [person, onRecover],
  );

  return (
    <ListRow title={person.title} detail={person.detail}>
      {person.isYou ? null : (
        <ActionMenu label={optionsFor(person.displayName)} actions={actions} />
      )}
    </ListRow>
  );
}
