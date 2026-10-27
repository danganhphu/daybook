"use client";

import type { AccountView } from "@/features/access/web/account-view";
import { Screen } from "@/shared/ui/screen/screen";

import { Devices } from "./devices";
import { settingsCopy } from "./settings-copy";
import { useAccountStepUp } from "./use-step-up";

export function DevicesSection({
  view,
  back,
}: {
  readonly view: AccountView;
  readonly back: string;
}) {
  const stepUp = useAccountStepUp(view);

  return (
    <Screen title={settingsCopy.devices} back={back}>
      <Devices devices={view.devices} run={stepUp.run} />
      {stepUp.dialog}
    </Screen>
  );
}
