"use client";

import type { AccountView } from "@/features/access/web/account-view";
import { Screen } from "@/shared/ui/screen/screen";

import { People } from "./people";
import { settingsCopy } from "./settings-copy";
import { useAccountStepUp } from "./use-step-up";

export function PeopleSection({
  view,
  back,
}: {
  readonly view: AccountView;
  readonly back: string;
}) {
  const stepUp = useAccountStepUp(view);

  return (
    <Screen title={settingsCopy.people} back={back}>
      <People people={view.people} run={stepUp.run} />
      {stepUp.dialog}
    </Screen>
  );
}
