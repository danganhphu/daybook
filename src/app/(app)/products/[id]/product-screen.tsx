"use client";

import { startTransition, useCallback, useMemo, useState } from "react";

import { MergeDialog } from "@/app/(app)/_merge/merge-dialog";
import { NameDialog } from "@/app/(app)/_names/name-dialog";
import { OtherNames } from "@/app/(app)/_names/other-names";
import { findProducts } from "@/app/(app)/orders/actions";
import {
  addProductName,
  hideProduct,
  mergeProduct,
  productMergeConfirm,
  removeProductName,
  renameProduct,
  showProduct,
} from "@/app/(app)/products/actions";
import { mergingCopy, pickProductHint } from "@/features/merging/web/merging-copy";
import type { DatedOrderRowView } from "@/features/orders/web/commands";
import { shortDay } from "@/features/orders/web/day-text";
import { describeProduct } from "@/features/orders/web/order-view";
import { productNameMaxLength } from "@/features/products/domain/product";
import type { ProductScreenView } from "@/features/products/web/product-view";
import { productsCopy } from "@/features/products/web/products-copy";
import { actionLabels } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { ButtonLink } from "@/shared/ui/button/button-link";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { iconTones } from "@/shared/ui/icon/icon-tone";
import {
  EditIcon,
  MergeIcon,
  ReceiptLongIcon,
  VisibilityIcon,
  VisibilityOffIcon,
} from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListLink } from "@/shared/ui/list/list-link";
import { Notice } from "@/shared/ui/notice/notice";
import { PageHeader } from "@/shared/ui/page-header/page-header";
import { Screen } from "@/shared/ui/screen/screen";
import { Stats, type Stat } from "@/shared/ui/stats/stats";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import { moneyText } from "@/shared/web/money-text";
import { orderPath, productPath, routes } from "@/shared/web/routes";

export type ProductScreenProps = {
  readonly view: ProductScreenView;
  // Newest first
  readonly orders: ReadonlyArray<DatedOrderRowView>;
};

const suggestProducts = (text: string) => findProducts(text, undefined);

// One product: how it sells, the other names it answers to, and the orders that sold it. Renaming, hiding and merging
// are in the menu; a merged one only says where it went.
export function ProductScreen({ view, orders }: ProductScreenProps) {
  const toast = useToast();
  const [dialog, setDialog] = useState<"rename" | "merge">();
  const close = useCallback(() => setDialog(undefined), []);
  const openRename = useCallback(() => setDialog("rename"), []);
  const openMerge = useCallback(() => setDialog("merge"), []);

  const toggleHidden = useCallback(() => {
    startTransition(async () => {
      const change = view.hidden ? showProduct : hideProduct;
      const result = await attempt(() => change(view.id, view.version));
      toast.show({
        title: result.ok
          ? view.hidden
            ? productsCopy.shownToast
            : productsCopy.hiddenToast
          : result.error,
      });
    });
  }, [toast, view.hidden, view.id, view.version]);

  const rename = useCallback(
    (name: string) => renameProduct(view.id, view.version, name),
    [view.id, view.version],
  );
  const renamed = useCallback(() => toast.show({ title: productsCopy.renamedToast }), [toast]);
  const addName = useCallback((name: string) => addProductName(view.id, name), [view.id]);
  const confirm = useCallback((intoId: string) => productMergeConfirm(view.id, intoId), [view.id]);
  const merge = useCallback(
    (intoId: string) => mergeProduct(view.id, view.version, intoId),
    [view.id, view.version],
  );

  const actions = useMemo<ReadonlyArray<MenuAction>>(
    () => [
      { label: productsCopy.rename, icon: EditIcon, onSelect: openRename },
      view.hidden
        ? { label: productsCopy.show, icon: VisibilityIcon, onSelect: toggleHidden }
        : { label: productsCopy.hide, icon: VisibilityOffIcon, onSelect: toggleHidden },
      { label: mergingCopy.mergeProduct, icon: MergeIcon, onSelect: openMerge },
    ],
    [openMerge, openRename, toggleHidden, view.hidden],
  );
  // A merged product has nothing left to change: its order lines are with the one kept
  const menu = useMemo(
    () =>
      view.mergedInto === undefined ? (
        <ActionMenu label={actionLabels.options} actions={actions} />
      ) : undefined,
    [actions, view.mergedInto],
  );

  const stats = useMemo<ReadonlyArray<Stat>>(
    () => [
      {
        label: productsCopy.lastPrice,
        value: view.lastPrice === undefined ? "-" : moneyText(view.lastPrice),
      },
      { label: productsCopy.orderCount, value: String(view.orderCount) },
    ],
    [view.lastPrice, view.orderCount],
  );

  return (
    <Screen>
      <PageHeader title={view.name} back={routes.products} actions={menu} />

      {view.mergedInto === undefined ? null : (
        <Notice message={mergingCopy.productIsMerged}>
          <ButtonLink href={productPath(view.mergedInto)}>{mergingCopy.seeKept}</ButtonLink>
        </Notice>
      )}
      {view.hidden && view.mergedInto === undefined ? (
        <Notice message={productsCopy.isHidden} />
      ) : null}

      <Stats label={view.name} items={stats} />

      <OtherNames
        names={view.otherNames}
        footer={productsCopy.otherNamesFooter}
        maxLength={productNameMaxLength}
        editable={!view.hidden}
        add={addName}
        remove={removeProductName}
      />

      {orders.length === 0 ? (
        <EmptyState title={productsCopy.noOrders} />
      ) : (
        <List heading={productsCopy.orders}>
          {orders.map((order) => (
            <ListLink
              key={order.id}
              href={orderPath(order.id)}
              title={order.customerName}
              detail={`${shortDay(order.orderedOn)}, ${order.products}`}
              value={moneyText(order.total)}
              icon={ReceiptLongIcon}
              iconTone={order.owed > 0 ? iconTones.owed : iconTones.money}
            />
          ))}
        </List>
      )}

      {dialog === "rename" ? (
        <NameDialog
          title={productsCopy.rename}
          label={productsCopy.name}
          initial={view.name}
          maxLength={productNameMaxLength}
          save={rename}
          onSaved={renamed}
          onClose={close}
        />
      ) : null}
      {dialog === "merge" ? (
        <MergeDialog
          title={mergingCopy.pickProduct}
          hint={pickProductHint(view.name)}
          label={mergingCopy.keptProduct}
          emptyText={mergingCopy.noProduct}
          fromId={view.id}
          suggest={suggestProducts}
          describe={describeProduct}
          confirm={confirm}
          merge={merge}
          keptPath={productPath}
          done={mergingCopy.mergedProduct}
          onClose={close}
        />
      ) : null}
    </Screen>
  );
}
