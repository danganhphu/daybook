"use client";

import {
  startTransition,
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";

import type { SettingsResult } from "@/features/access/web/settings-commands";
import { timesOfDay } from "@/features/notifications/domain/time-of-day";
import {
  permissionNow,
  unsubscribeThisBrowser,
  watchPermission,
} from "@/features/notifications/web/browser-push";
import type {
  NotificationTimesView,
  NotificationsView,
  NotifiedDeviceRow,
} from "@/features/notifications/web/notification-view";
import { notificationsCopy } from "@/features/notifications/web/notifications-copy";
import { usePushDevice, type PushDevice } from "@/features/notifications/web/use-push-device";
import { dayCount } from "@/features/reports/web/reports-copy";
import { err } from "@/shared/domain/result";
import { optionsFor } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { Button } from "@/shared/ui/button/button";
import { useConfirm } from "@/shared/ui/dialog/use-confirm";
import { DeleteIcon } from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListContent } from "@/shared/ui/list/list-content";
import { ListRow } from "@/shared/ui/list/list-row";
import { Screen } from "@/shared/ui/screen/screen";
import { SelectField } from "@/shared/ui/select-field/select-field";
import { attempt } from "@/shared/web/attempt";

import { EditableRow } from "./editable-row";
import {
  saveNotificationQuietDays,
  saveNotificationTimes,
  turnOffPush,
} from "./notification-actions";
import { settingsCopy } from "./settings-copy";
import { turnOnHere } from "./turn-on-push";
import { useOutcomeToast } from "./use-outcome-toast";

import styles from "./settings.module.scss";

const timeOptions = timesOfDay.map((time) => ({ value: time, label: time }));
const daysField = { inputMode: "numeric" } as const;

function deviceState(device: PushDevice | undefined, on: boolean): string | undefined {
  switch (device) {
    case undefined:
      return undefined;
    case "unsupported":
      return notificationsCopy.unsupported;
    case "blocked":
      return notificationsCopy.blocked;
    case "undecided":
    case "allowed":
      return on ? notificationsCopy.on : notificationsCopy.off;
    default:
      return device satisfies never;
  }
}

function withTimes(
  shown: NotificationTimesView,
  changed: Partial<NotificationTimesView>,
): NotificationTimesView {
  return { ...shown, ...changed };
}

// This device on or off, the two times, and every device that receives. Security notices cannot be turned off.
export function NotificationsSection({
  view,
  back,
}: {
  readonly view: NotificationsView;
  readonly back: string;
}) {
  const device = usePushDevice();
  const tell = useOutcomeToast();
  const [working, startWorking] = useTransition();
  // Turned on by a tap whose prompt closed unanswered: allowed later from Chrome's site settings, it finishes then
  const [waitingForPermission, setWaitingForPermission] = useState(false);
  const on = view.thisDevice !== undefined;
  const { publicKey, thisDevice } = view;

  const turnOn = useCallback(() => {
    if (publicKey === undefined) {
      return;
    }
    startWorking(async () => {
      const said = await turnOnHere(publicKey);
      setWaitingForPermission(said === undefined && permissionNow() === "default");
      tell(said);
    });
  }, [publicKey, tell]);

  useEffect(() => {
    if (!waitingForPermission) {
      return undefined;
    }

    return watchPermission(() => {
      if (permissionNow() === "granted") {
        setWaitingForPermission(false);
        turnOn();
      }
    });
  }, [turnOn, waitingForPermission]);

  const turnOff = useCallback(() => {
    if (thisDevice === undefined) {
      return;
    }
    startWorking(async () => {
      try {
        await unsubscribeThisBrowser();
      } catch {
        // The server forgets it either way, and sends it nothing more
      }
      const result = await attempt(() => turnOffPush(thisDevice));
      tell(result.ok ? notificationsCopy.turnedOff : result.error);
    });
  }, [tell, thisDevice]);

  const [times, showTimes] = useOptimistic<NotificationTimesView, Partial<NotificationTimesView>>(
    view,
    withTimes,
  );
  const saveTimes = useCallback(
    (changed: Partial<NotificationTimesView>) => {
      startWorking(async () => {
        showTimes(changed);
        const next = withTimes(times, changed);
        const result = await attempt(() =>
          saveNotificationTimes({
            morningAt: next.morningAt ?? null,
            weeklyAt: next.weeklyAt ?? null,
            version: next.version ?? null,
          }),
        );
        tell(result.ok ? notificationsCopy.timesSaved : result.error);
      });
    },
    [showTimes, tell, times],
  );
  // An empty value is the "Tắt" choice
  const pickMorning = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) =>
      saveTimes({ morningAt: event.target.value || undefined }),
    [saveTimes],
  );
  const pickWeekly = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) =>
      saveTimes({ weeklyAt: event.target.value || undefined }),
    [saveTimes],
  );
  const { version } = view;
  // The row shows a refusal's sentence; its code matters only to step-up, which this does not ask for
  const saveQuietDays = useCallback(
    async (value: string): Promise<SettingsResult<null>> => {
      const saved = await attempt(() => saveNotificationQuietDays(value, version ?? null));
      return saved.ok ? saved : err({ code: "invalid", message: saved.error });
    },
    [version],
  );

  return (
    <Screen title={settingsCopy.notifications} back={back}>
      {view.available ? (
        <List footer={notificationsCopy.securityAlwaysOn}>
          <ListRow title={notificationsCopy.thisDevice} detail={deviceState(device, on)}>
            {device === "allowed" || device === "undecided" ? (
              <Button variant="quiet" disabled={working} onClick={on ? turnOff : turnOn}>
                {on ? notificationsCopy.turnOff : notificationsCopy.turnOn}
              </Button>
            ) : null}
          </ListRow>
        </List>
      ) : (
        <List>
          <ListRow title={notificationsCopy.thisDevice} detail={notificationsCopy.unavailable} />
        </List>
      )}

      <List heading={notificationsCopy.times}>
        <ListContent>
          <div className={styles.form}>
            <SelectField
              label={notificationsCopy.morning}
              options={timeOptions}
              emptyLabel={notificationsCopy.timeOff}
              value={times.morningAt ?? ""}
              disabled={working}
              onChange={pickMorning}
            />
            <SelectField
              label={notificationsCopy.weekly}
              options={timeOptions}
              emptyLabel={notificationsCopy.timeOff}
              value={times.weeklyAt ?? ""}
              disabled={working}
              onChange={pickWeekly}
            />
          </div>
        </ListContent>
      </List>

      <List heading={notificationsCopy.quiet} footer={notificationsCopy.quietUse}>
        <EditableRow
          label={notificationsCopy.quietDays}
          value={String(view.quietAfterDays)}
          display={dayCount(view.quietAfterDays)}
          description={notificationsCopy.quietRange}
          field={daysField}
          save={saveQuietDays}
          saved={notificationsCopy.quietSaved}
        />
      </List>

      {view.devices.length === 0 ? null : (
        <List heading={notificationsCopy.devices}>
          {view.devices.map((row) => (
            <DeviceItem key={row.id} device={row} />
          ))}
        </List>
      )}
    </Screen>
  );
}

function DeviceItem({ device }: { readonly device: NotifiedDeviceRow }) {
  const tell = useOutcomeToast();
  const { confirm, dialog } = useConfirm();
  const remove = useMemo<MenuAction>(
    () => ({
      label: notificationsCopy.remove,
      icon: DeleteIcon,
      onSelect: () => {
        void (async () => {
          const sure = await confirm({
            title: `${notificationsCopy.remove} ${device.title}?`,
            description: notificationsCopy.removeMeans,
            confirmLabel: notificationsCopy.remove,
          });
          if (!sure) {
            return;
          }
          startTransition(async () => {
            const result = await attempt(() => turnOffPush(device.id));
            tell(result.ok ? `${notificationsCopy.removed} ${device.title}` : result.error);
          });
        })();
      },
    }),
    [confirm, device.id, device.title, tell],
  );

  return (
    <ListRow title={device.title} detail={device.detail}>
      {device.current ? null : <ActionMenu label={optionsFor(device.title)} destructive={remove} />}
      {dialog}
    </ListRow>
  );
}
