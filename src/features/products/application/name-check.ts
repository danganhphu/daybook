import type { ProductId, ProductName } from "@/features/products/domain/product";
import type { ProductRepository } from "@/features/products/domain/product-repository";
import { searchText } from "@/shared/domain/search-text";

// Whether a name already means a shown product other than this one, by its name or another it is known by: one name,
// one product, or an order line naming it would not know which
export async function nameTaken(
  products: ProductRepository,
  name: ProductName,
  except?: ProductId,
): Promise<boolean> {
  const holder = (await products.findActiveNamed([name])).get(searchText(name));

  return holder !== undefined && holder.id !== except;
}
