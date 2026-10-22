"use client";

import { useCallback, type FocusEvent } from "react";

import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { Dialog } from "@/shared/ui/dialog/dialog";
import { TextField } from "@/shared/ui/text-field/text-field";
import { useBrowserCapability } from "@/shared/web/use-browser-capability";

import { useOutcomeToast } from "./use-outcome-toast";

export type IssuedLink = {
  readonly title: string;
  // Who it is for, and what using it does
  readonly description: string;
  readonly url: string;
};

export type LinkDialogProps = {
  readonly open: boolean;
  // Kept after the dialog closes, so its words do not change while it fades out
  readonly link: IssuedLink | undefined;
  readonly onClose: () => void;
};

function canShare() {
  return typeof navigator.share === "function";
}

function selectAll(event: FocusEvent<HTMLInputElement>) {
  event.currentTarget.select();
}

// A setup link, shown once: the server keeps only its hash, so once this closes nobody can see it again. On a phone
// it goes out through the share sheet (Zalo, Messenger...); anywhere, it can be copied.
export function LinkDialog({ open, link, onClose }: LinkDialogProps) {
  const tell = useOutcomeToast();
  const sharing = useBrowserCapability(canShare, false);

  const share = useCallback(async () => {
    if (link === undefined) {
      return;
    }
    try {
      await navigator.share({ title: link.title, url: link.url });
    } catch (error) {
      // Closing the share sheet is not a failure
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        tell("Không chia sẻ được. Hãy sao chép link.");
      }
    }
  }, [link, tell]);

  const copy = useCallback(async () => {
    if (link === undefined) {
      return;
    }
    try {
      await navigator.clipboard.writeText(link.url);
      tell("Đã sao chép link");
    } catch {
      tell("Không sao chép được. Hãy chọn link rồi sao chép.");
    }
  }, [link, tell]);

  const onShare = useCallback(() => void share(), [share]);
  const onCopy = useCallback(() => void copy(), [copy]);

  return (
    <Dialog open={open} onClose={onClose} title={link?.title ?? ""} description={link?.description}>
      <TextField label="Link" value={link?.url ?? ""} readOnly onFocus={selectAll} />
      {sharing ? (
        <Button variant="primary" size="lg" onClick={onShare}>
          Chia sẻ
        </Button>
      ) : null}
      <Button variant={sharing ? "secondary" : "primary"} size="lg" onClick={onCopy}>
        Sao chép
      </Button>
      <Button variant="quiet" onClick={onClose}>
        {actionLabels.done}
      </Button>
    </Dialog>
  );
}
