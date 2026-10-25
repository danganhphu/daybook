import type { Suggestion } from "@/shared/ui/suggest-field/suggest-field";

// What the browser gets for orders: plain values that cross the server-client boundary. Days are YYYY-MM-DD,
// money is whole đồng.

export type OrderRowView = {
  readonly id: string;
  readonly customerName: string;
  readonly customerArea: string | undefined;
  // "Thuốc tê Lidocaine, Găng tay"
  readonly products: string;
  readonly total: number;
  readonly owed: number;
  readonly delivered: boolean;
};

export type OrderTotalsView = {
  readonly count: number;
  readonly total: number;
  readonly paid: number;
  readonly owed: number;
};

export type OrderLineView = {
  // Its place in the order, which also tells two lines of one product apart
  readonly position: number;
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: number;
};

export type PaymentView = {
  readonly id: string;
  readonly amount: number;
  readonly paidOn: string;
  readonly method: string | undefined;
  readonly note: string | undefined;
  readonly removed: boolean;
};

export type HistoryEntryView = {
  readonly id: string;
  // "23/10, 09:12"
  readonly at: string;
  readonly by: string;
  readonly headline: string;
  readonly details: ReadonlyArray<string>;
};

export type OrderScreenView = {
  readonly id: string;
  readonly version: number;
  readonly deleted: boolean;
  readonly customerId: string;
  readonly customerName: string;
  readonly customerArea: string | undefined;
  readonly orderedOn: string;
  readonly deliveredOn: string | undefined;
  readonly note: string | undefined;
  readonly lines: ReadonlyArray<OrderLineView>;
  readonly total: number;
  readonly paid: number;
  readonly owed: number;
  readonly payments: ReadonlyArray<PaymentView>;
  readonly history: ReadonlyArray<HistoryEntryView>;
  // For the date fields: no later day
  readonly today: string;
};

// The order form: empty for a new order, filled for an edit
export type OrderFormView = {
  readonly order:
    | {
        readonly id: string;
        readonly version: number;
        readonly orderedOn: string;
        readonly note: string | undefined;
        readonly lines: ReadonlyArray<OrderLineView>;
      }
    | undefined;
  readonly customer:
    | { readonly id: string; readonly name: string; readonly area: string | undefined }
    | undefined;
  readonly today: string;
};

// A suggestion under a field as it is typed
export type CustomerSuggestion = {
  readonly id: string;
  readonly name: string;
  readonly area: string | undefined;
};

// A customer in a list of suggestions: the name, and the area that tells two of one name apart
export function describeCustomer(customer: CustomerSuggestion): Suggestion {
  return { key: customer.id, label: customer.name, detail: customer.area };
}

export type ProductSuggestion = {
  readonly id: string;
  readonly name: string;
  // The price to fill in: this customer's last, else anyone's
  readonly lastPrice: number | undefined;
};
