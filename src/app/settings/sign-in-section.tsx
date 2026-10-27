"use client";

import type { AccountView } from "@/features/access/web/account-view";
import { Screen } from "@/shared/ui/screen/screen";

import { settingsCopy } from "./settings-copy";
import { SignInMethods } from "./sign-in-methods";
import { useAccountStepUp } from "./use-step-up";

export function SignInSection({
  view,
  back,
}: {
  readonly view: AccountView;
  readonly back: string;
}) {
  const stepUp = useAccountStepUp(view);

  return (
    <Screen title={settingsCopy.signInMethods} back={back}>
      <SignInMethods
        view={view}
        hasOtherDevices={view.devices.some((device) => !device.current)}
        run={stepUp.run}
      />
      {stepUp.dialog}
    </Screen>
  );
}
