"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { NameDialog } from "@/app/(app)/_names/name-dialog";
import { productNameMaxLength } from "@/features/products/domain/product";
import { productsCopy } from "@/features/products/web/products-copy";
import { IconButton } from "@/shared/ui/button/icon-button";
import { AddIcon } from "@/shared/ui/icon/icons";
import { useToast } from "@/shared/ui/toast/use-toast";
import { productPath } from "@/shared/web/routes";

import { addProduct } from "./actions";

// A product before any order names it; its page opens once it is added
export function AddProduct() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const added = useCallback(
    (id: string) => {
      toast.show({ title: productsCopy.addedToast });
      router.push(productPath(id));
    },
    [router, toast],
  );

  return (
    <>
      <IconButton icon={AddIcon} label={productsCopy.add} onClick={show} />
      {open ? (
        <NameDialog
          title={productsCopy.add}
          label={productsCopy.name}
          maxLength={productNameMaxLength}
          save={addProduct}
          onSaved={added}
          onClose={close}
        />
      ) : null}
    </>
  );
}
