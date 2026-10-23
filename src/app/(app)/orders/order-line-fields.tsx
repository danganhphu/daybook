"use client";

import { useCallback, type ChangeEvent } from "react";

import type { ProductSuggestion } from "@/features/orders/web/order-view";
import { ordersCopy } from "@/features/orders/web/orders-copy";
import { IconButton } from "@/shared/ui/button/icon-button";
import { CloseIcon } from "@/shared/ui/icon/icons";
import { SuggestField } from "@/shared/ui/suggest-field/suggest-field";
import { TextField } from "@/shared/ui/text-field/text-field";
import { groupedDigits, moneyText, parseMoneyInput } from "@/shared/web/money-text";

import styles from "./order-form.module.scss";

// A line as the form holds it: text as typed, so a half-typed number is never lost
export type LineState = {
  readonly key: string;
  // Set when a suggestion was picked; cleared when the name is typed over
  readonly productId: string | undefined;
  readonly productName: string;
  readonly quantity: string;
  readonly price: string;
};

export function wholeNumber(text: string): number | undefined {
  return /^\d{1,6}$/.test(text.trim()) ? Number(text.trim()) : undefined;
}

export function lineAmount(line: LineState): number {
  return (wholeNumber(line.quantity) ?? 0) * (parseMoneyInput(line.price) ?? 0);
}

const describeProduct = (product: ProductSuggestion) => ({
  key: product.id,
  label: product.name,
  detail: product.lastPrice === undefined ? undefined : moneyText(product.lastPrice),
});

export type OrderLineFieldsProps = {
  readonly line: LineState;
  // 1-based, for the labels: "Món hàng 2"
  readonly number: number;
  readonly removable: boolean;
  readonly focusOnMount: boolean;
  readonly suggest: (text: string) => Promise<ReadonlyArray<ProductSuggestion>>;
  readonly onChange: (key: string, change: Partial<LineState>) => void;
  readonly onRemove: (key: string) => void;
};

// One line of the order form: the product, picked or new; how many; the price, filled from the last sale when known
export function OrderLineFields({
  line,
  number,
  removable,
  focusOnMount,
  suggest,
  onChange,
  onRemove,
}: OrderLineFieldsProps) {
  const { key, price } = line;

  const typeProduct = useCallback(
    (text: string) => onChange(key, { productName: text, productId: undefined }),
    [key, onChange],
  );
  const pickProduct = useCallback(
    (product: ProductSuggestion) =>
      onChange(key, {
        productId: product.id,
        productName: product.name,
        ...(price.trim() === "" && product.lastPrice !== undefined
          ? { price: groupedDigits(product.lastPrice) }
          : {}),
      }),
    [key, onChange, price],
  );
  const typeQuantity = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onChange(key, { quantity: event.target.value }),
    [key, onChange],
  );
  const typePrice = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onChange(key, { price: event.target.value }),
    [key, onChange],
  );
  // Grouped once the field is left, so "850000" reads as "850.000"
  const groupPrice = useCallback(() => {
    const amount = parseMoneyInput(price);
    if (amount !== undefined) {
      onChange(key, { price: groupedDigits(amount) });
    }
  }, [key, onChange, price]);
  const remove = useCallback(() => onRemove(key), [key, onRemove]);

  return (
    <div className={styles.line}>
      <div className={styles.lineHead}>
        <SuggestField
          label={`${ordersCopy.product} ${number}`}
          value={line.productName}
          onValueChange={typeProduct}
          suggest={suggest}
          describe={describeProduct}
          onPick={pickProduct}
          placeholder={ordersCopy.searchProduct}
          emptyText={ordersCopy.productUnknown}
          focusOnMount={focusOnMount}
        />
        {removable ? (
          <IconButton
            icon={CloseIcon}
            label={`${ordersCopy.removeLine} (${number})`}
            onClick={remove}
          />
        ) : null}
      </div>
      <div className={styles.numbers}>
        <TextField
          label={ordersCopy.quantity}
          inputMode="numeric"
          value={line.quantity}
          onChange={typeQuantity}
        />
        <TextField
          label={`${ordersCopy.unitPrice} (đ)`}
          inputMode="numeric"
          value={line.price}
          onChange={typePrice}
          onBlur={groupPrice}
        />
      </div>
      <p className={styles.amount}>{moneyText(lineAmount(line))}</p>
    </div>
  );
}
