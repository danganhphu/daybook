"use client";

import { LogOut } from "lucide-react";
import { useCallback, useMemo, useTransition } from "react";

import { accessCopy } from "@/features/access/web/access-copy";
import type { DeviceRow } from "@/features/access/web/account-view";
import { problemMessage } from "@/features/access/web/attempt-setting";
import type { SettingsResult } from "@/features/access/web/settings-commands";
import { optionsFor } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { List } from "@/shared/ui/list/list";
import { ListAction } from "@/shared/ui/list/list-action";
import { ListRow } from "@/shared/ui/list/list-row";

import { endDevice, endOtherDevices } from "./actions";
import { useOutcomeToast } from "./use-outcome-toast";
import type { StepUp } from "./use-step-up";

export type DevicesProps = {
  readonly devices: ReadonlyArray<DeviceRow>;
  readonly run: StepUp["run"];
};

// Where this account is signed in. Any other device can be signed out from here, one or all at once; this one signs
// out at the bottom of the page. Not undoable, but nothing is lost: the device just signs in again.
export function Devices({ devices, run }: DevicesProps) {
  const tell = useOutcomeToast();
  const [working, startWorking] = useTransition();
  const hasOthers = devices.some((device) => !device.current);

  const end = useCallback(
    (action: () => Promise<SettingsResult<null>>, done: string) => {
      startWorking(async () => {
        const ended = await run(action);
        tell(ended.ok ? done : problemMessage(ended.error));
      });
    },
    [run, tell],
  );

  const endOne = useCallback(
    (device: DeviceRow) => end(() => endDevice(device.id), `Đã đăng xuất ${device.title}`),
    [end],
  );
  const endOthers = useCallback(
    () => end(() => endOtherDevices(), `Đã ${accessCopy.signOutOthers.toLocaleLowerCase("vi")}`),
    [end],
  );

  return (
    <List heading="Thiết bị đang đăng nhập">
      {devices.map((device) => (
        <DeviceItem key={device.id} device={device} onEnd={endOne} />
      ))}
      {hasOthers ? (
        <ListAction
          label={accessCopy.signOutOthers}
          icon={LogOut}
          tone="danger"
          disabled={working}
          onClick={endOthers}
        />
      ) : null}
    </List>
  );
}

function DeviceItem({
  device,
  onEnd,
}: {
  readonly device: DeviceRow;
  readonly onEnd: (device: DeviceRow) => void;
}) {
  const destructive = useMemo<MenuAction>(
    () => ({ label: accessCopy.signOut, icon: LogOut, onSelect: () => onEnd(device) }),
    [device, onEnd],
  );

  return (
    <ListRow title={device.title} detail={device.detail}>
      {device.current ? null : (
        <ActionMenu label={optionsFor(device.title)} destructive={destructive} />
      )}
    </ListRow>
  );
}
