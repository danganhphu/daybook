import Form from "next/form";

import { TabActions } from "@/app/(app)/_shell/tab-actions";
import type { CustomersView } from "@/features/customers/web/commands";
import { customersCopy } from "@/features/customers/web/customers-copy";
import { customersPath } from "@/features/customers/web/customers-path";
import { searchTermMaxLength } from "@/shared/domain/search-text";
import { ChipLinks, type ChipLink } from "@/shared/ui/chip-links/chip-links";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { FabLink } from "@/shared/ui/fab/fab-link";
import { iconTones } from "@/shared/ui/icon/icon-tone";
import { AddIcon, PersonIcon } from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListLink } from "@/shared/ui/list/list-link";
import { QuietLink } from "@/shared/ui/quiet-link/quiet-link";
import { Screen } from "@/shared/ui/screen/screen";
import { SearchField } from "@/shared/ui/search-field/search-field";
import { moneyText } from "@/shared/web/money-text";
import { customerPath, routes } from "@/shared/web/routes";

// All kinds, then one chip a kind; the search and the hidden view carry over
function kindChips(view: CustomersView): ReadonlyArray<ChipLink> {
  const hidden = view.showingHidden ? ("1" as const) : undefined;

  return [
    {
      label: customersCopy.allKinds,
      href: customersPath({ q: view.query, hidden }),
      current: view.kindId === "",
    },
    ...view.kinds.map((kind) => ({
      label: kind.name,
      href: customersPath({ q: view.query, kind: kind.id, hidden }),
      current: kind.id === view.kindId,
    })),
  ];
}

// Every customer by name, what kind and where beneath, and what they owe at the end of the row, so the ones to chase
// stand out. The kind chips and the search narrow it; hidden customers are one link away.
export function CustomersScreen({
  view,
  unread,
}: {
  readonly view: CustomersView;
  readonly unread: number;
}) {
  const hidden = view.showingHidden ? ("1" as const) : undefined;
  // oxlint-disable-next-line react-perf/jsx-no-jsx-as-prop -- a server component renders once a request: nothing to memoize for
  const actions = view.showingHidden ? undefined : <TabActions unread={unread} />;

  return (
    <Screen
      title={view.showingHidden ? customersCopy.hidden : customersCopy.title}
      back={view.showingHidden ? routes.customers : undefined}
      actions={actions}
    >
      <search>
        <Form action={routes.customers}>
          {hidden === undefined ? null : <input type="hidden" name="hidden" value={hidden} />}
          {view.kindId === "" ? null : <input type="hidden" name="kind" value={view.kindId} />}
          <SearchField
            label={customersCopy.search}
            name="q"
            defaultValue={view.query}
            placeholder={customersCopy.searchPlaceholder}
            maxLength={searchTermMaxLength}
            autoComplete="off"
          />
        </Form>
      </search>

      {view.kinds.length === 0 ? null : (
        <ChipLinks label={customersCopy.fields.kind} chips={kindChips(view)} />
      )}

      {view.rows.length === 0 ? (
        <EmptyState
          title={view.filtered ? customersCopy.notFound : customersCopy.empty}
          description={view.filtered || view.showingHidden ? undefined : customersCopy.emptyHint}
        />
      ) : (
        <List footer={view.more ? customersCopy.more : undefined}>
          {view.rows.map((row) => (
            <ListLink
              key={row.id}
              href={customerPath(row.id)}
              title={row.name}
              detail={row.detail}
              value={row.owed > 0 ? `${customersCopy.owes} ${moneyText(row.owed)}` : undefined}
              valueTone="danger"
              icon={PersonIcon}
              iconTone={iconTones.customer}
            />
          ))}
        </List>
      )}

      {view.showingHidden ? null : (
        <>
          <QuietLink href={customersPath({ hidden: "1" })}>{customersCopy.hidden}</QuietLink>
          <FabLink icon={AddIcon} label={customersCopy.add} href={routes.newCustomer} />
        </>
      )}
    </Screen>
  );
}
