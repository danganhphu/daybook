"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useMemo, useState } from "react";

import { MergeDialog } from "@/app/(app)/_merge/merge-dialog";
import { NameDialog } from "@/app/(app)/_names/name-dialog";
import { OtherNames } from "@/app/(app)/_names/other-names";
import { undoDelete } from "@/app/(app)/deleted/undo-delete";
import { findProducts } from "@/app/(app)/orders/actions";
import {
  addProductName,
  deleteProduct,
  hideProduct,
  mergeProduct,
  productDeleteConfirm,
  productMergeConfirm,
  removeProductName,
  renameProduct,
  showProduct,
} from "@/app/(app)/products/actions";
import { mergingCopy, pickProductHint } from "@/features/merging/web/merging-copy";
import type { DatedOrderRowView } from "@/features/orders/web/commands";
import { shortDay } from "@/features/orders/web/day-text";
import { describeProduct } from "@/features/orders/web/order-view";
import { productNameMaxLength } from "@/features/products/domain/product-limits";
import type { ProductScreenView } from "@/features/products/web/product-view";
import { productsCopy } from "@/features/products/web/products-copy";
import { actionLabels } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { ButtonLink } from "@/shared/ui/button/button-link";
import { useConfirm } from "@/shared/ui/dialog/use-confirm";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { iconTones } from "@/shared/ui/icon/icon-tone";
import {
  DeleteIcon,
  EditIcon,
  MergeIcon,
  ReceiptLongIcon,
  VisibilityIcon,
  VisibilityOffIcon,
} from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListLink } from "@/shared/ui/list/list-link";
import { Notice } from "@/shared/ui/notice/notice";
import { Screen } from "@/shared/ui/screen/screen";
import { Stats, type Stat } from "@/shared/ui/stats/stats";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import { moneyText } from "@/shared/web/money-text";
import { recentlyDeletedCopy } from "@/shared/web/recently-deleted";
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

  const router = useRouter();
  const { confirm: ask, dialog: question } = useConfirm();
  // Asked first. One an order names cannot go, so the question offers to hide it instead; otherwise the list, with
  // Undo in the toast.
  const remove = useCallback(() => {
    void (async () => {
      const asked = await attempt(() => productDeleteConfirm(view.id));
      if (!asked.ok) {
        toast.show({ title: asked.error });
        return;
      }
      const { hideInstead, ...request } = asked.value;
      if (!(await ask({ ...request, tone: hideInstead ? "neutral" : "danger" }))) {
        return;
      }
      if (hideInstead) {
        toggleHidden();
        return;
      }
      startTransition(async () => {
        const result = await attempt(() => deleteProduct(view.id, view.version));
        if (!result.ok) {
          toast.show({ title: result.error });
          return;
        }
        const version = result.value;
        toast.show({
          title: productsCopy.deleted,
          action: {
            label: actionLabels.undo,
            onAction: () => {
              startTransition(async () => {
                toast.show(await undoDelete({ kind: "product", id: view.id, version }));
              });
            },
          },
        });
        router.push(routes.products);
      });
    })();
  }, [ask, router, toast, toggleHidden, view.id, view.version]);

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
  const destructive = useMemo<MenuAction>(
    () => ({ label: productsCopy.remove, icon: DeleteIcon, onSelect: remove }),
    [remove],
  );
  // A merged product has nothing left to change: its order lines are with the one kept. A deleted one comes back from
  // the trash.
  const menu = useMemo(
    () =>
      view.mergedInto === undefined && !view.deleted ? (
        <ActionMenu label={actionLabels.options} actions={actions} destructive={destructive} />
      ) : undefined,
    [actions, destructive, view.deleted, view.mergedInto],
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
    <Screen title={view.name} back={routes.products} actions={menu}>
      {view.mergedInto === undefined ? null : (
        <Notice message={mergingCopy.productIsMerged}>
          <ButtonLink href={productPath(view.mergedInto)}>{mergingCopy.seeKept}</ButtonLink>
        </Notice>
      )}
      {view.deleted ? (
        <Notice message={productsCopy.isDeleted} tone="danger">
          <ButtonLink href={routes.deleted}>{recentlyDeletedCopy.title}</ButtonLink>
        </Notice>
      ) : null}
      {view.hidden && view.mergedInto === undefined && !view.deleted ? (
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
      {question}
    </Screen>
  );
}
