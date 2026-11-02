"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import type { AccountView } from "@/features/access/web/account-view";
import { problemMessage } from "@/features/access/web/attempt-setting";
import { Button } from "@/shared/ui/button/button";
import { ButtonLink } from "@/shared/ui/button/button-link";
import { useConfirm } from "@/shared/ui/dialog/use-confirm";
import { List } from "@/shared/ui/list/list";
import { ListContent } from "@/shared/ui/list/list-content";
import { ListRow } from "@/shared/ui/list/list-row";
import { Screen } from "@/shared/ui/screen/screen";

import { settingsCopy, telegramLinkedAs, telegramOpenHint } from "./settings-copy";
import { connectTelegram, disconnectTelegram } from "./telegram-actions";
import { useOutcomeToast } from "./use-outcome-toast";
import { useAccountStepUp } from "./use-step-up";

import styles from "./settings.module.scss";

// Which Telegram writes into the book as this person, and since when
export type TelegramLinkedView = { readonly name: string; readonly since: string };

// Connect: a step-up, then a t.me link that opens the bot on this phone, whose Start links it. Coming back from
// Telegram refreshes the page, so it says it is connected without polling.
export function TelegramSection({
  view,
  linked,
  linkMinutes,
  back,
}: {
  readonly view: AccountView;
  readonly linked: TelegramLinkedView | undefined;
  // How long a t.me link works
  readonly linkMinutes: number;
  readonly back: string;
}) {
  const router = useRouter();
  const stepUp = useAccountStepUp(view);
  const tell = useOutcomeToast();
  const { confirm, dialog } = useConfirm();
  const [working, startWorking] = useTransition();
  const [startUrl, setStartUrl] = useState<string>();
  const waiting = startUrl !== undefined && linked === undefined;

  useEffect(() => {
    if (!waiting) {
      return undefined;
    }
    const onReturn = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onReturn);

    return () => document.removeEventListener("visibilitychange", onReturn);
  }, [router, waiting]);

  const { run } = stepUp;
  const connect = useCallback(() => {
    startWorking(async () => {
      const started = await run(() => connectTelegram());
      if (started.ok) {
        setStartUrl(started.value.url);
      } else {
        tell(problemMessage(started.error));
      }
    });
  }, [run, tell]);

  const disconnect = useCallback(() => {
    void (async () => {
      const sure = await confirm({
        title: settingsCopy.telegramDisconnectQuestion,
        description: settingsCopy.telegramDisconnectMeans,
        confirmLabel: settingsCopy.telegramDisconnect,
        tone: "danger",
      });
      if (!sure) {
        return;
      }
      startWorking(async () => {
        const ended = await run(() => disconnectTelegram());
        setStartUrl(undefined);
        tell(ended.ok ? settingsCopy.telegramDisconnected : problemMessage(ended.error));
      });
    })();
  }, [confirm, run, tell]);

  return (
    <Screen title={settingsCopy.telegram} back={back}>
      <List footer={settingsCopy.telegramUse}>
        {linked === undefined ? (
          <ListRow title={settingsCopy.telegram} detail={settingsCopy.telegramNotLinked}>
            <Button variant="quiet" disabled={working} onClick={connect}>
              {settingsCopy.telegramConnect}
            </Button>
          </ListRow>
        ) : (
          <ListRow title={telegramLinkedAs(linked.name)} detail={linked.since}>
            <Button variant="quiet" disabled={working} onClick={disconnect}>
              {settingsCopy.telegramDisconnect}
            </Button>
          </ListRow>
        )}
      </List>

      {waiting ? (
        <List footer={telegramOpenHint(linkMinutes)}>
          <ListContent>
            <div className={styles.form}>
              <ButtonLink href={startUrl} variant="primary" size="lg">
                {settingsCopy.telegramOpen}
              </ButtonLink>
            </div>
          </ListContent>
        </List>
      ) : null}
      {stepUp.dialog}
      {dialog}
    </Screen>
  );
}
