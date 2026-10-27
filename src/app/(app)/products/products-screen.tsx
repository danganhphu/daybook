import Form from "next/form";

import type { ProductsView } from "@/features/products/web/product-view";
import { productsCopy } from "@/features/products/web/products-copy";
import { productsPath } from "@/features/products/web/products-path";
import { searchTermMaxLength } from "@/shared/domain/search-text";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { iconTones } from "@/shared/ui/icon/icon-tone";
import { Inventory2Icon } from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListLink } from "@/shared/ui/list/list-link";
import { QuietLink } from "@/shared/ui/quiet-link/quiet-link";
import { Screen } from "@/shared/ui/screen/screen";
import { SearchField } from "@/shared/ui/search-field/search-field";
import { moneyText } from "@/shared/web/money-text";
import { productPath, routes } from "@/shared/web/routes";

import { AddProduct } from "./add-product";

const addProduct = <AddProduct />;

// Every product by name, how many orders sold it beneath, and its latest price at the end of the row. Reached from
// Đơn hàng; hidden products are one link away.
export function ProductsScreen({ view }: { readonly view: ProductsView }) {
  const hidden = view.showingHidden ? ("1" as const) : undefined;

  return (
    <Screen
      title={view.showingHidden ? productsCopy.hidden : productsCopy.title}
      back={view.showingHidden ? routes.products : routes.orders}
      actions={view.showingHidden ? undefined : addProduct}
    >
      <search>
        <Form action={routes.products}>
          {hidden === undefined ? null : <input type="hidden" name="hidden" value={hidden} />}
          <SearchField
            label={productsCopy.search}
            name="q"
            defaultValue={view.query}
            placeholder={productsCopy.searchPlaceholder}
            maxLength={searchTermMaxLength}
            autoComplete="off"
          />
        </Form>
      </search>

      {view.rows.length === 0 ? (
        <EmptyState
          title={view.filtered ? productsCopy.notFound : productsCopy.empty}
          description={view.filtered || view.showingHidden ? undefined : productsCopy.emptyHint}
        />
      ) : (
        <List>
          {view.rows.map((row) => (
            <ListLink
              key={row.id}
              href={productPath(row.id)}
              title={row.name}
              detail={row.detail}
              value={row.lastPrice === undefined ? undefined : moneyText(row.lastPrice)}
              icon={Inventory2Icon}
              iconTone={iconTones.item}
            />
          ))}
        </List>
      )}

      {view.showingHidden ? null : (
        <QuietLink href={productsPath({ hidden: "1" })}>{productsCopy.hidden}</QuietLink>
      )}
    </Screen>
  );
}
