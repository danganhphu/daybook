// Apart from customer.ts and customer-kind.ts so a form can show them without loading Zod and uuid
export const customerLimits = {
  name: 100,
  area: 60,
  phone: 20,
  address: 200,
  note: 1000,
} as const;

export const kindNameMaxLength = 40;
