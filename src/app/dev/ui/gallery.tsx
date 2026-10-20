"use client";

import { Ellipsis, Pencil, SendHorizontal, Trash2, X } from "lucide-react";
import { useCallback, useMemo, type ReactNode } from "react";

import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { Button } from "@/shared/ui/button/button";
import { IconButton } from "@/shared/ui/button/icon-button";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { TextArea } from "@/shared/ui/text-area/text-area";
import { useToast } from "@/shared/ui/toast/use-toast";

import styles from "./gallery.module.scss";

const sampleNote = "Giao 2 hộp gel tê cho PK Minh Tâm, thu 850.000đ";

const sampleActions: ReadonlyArray<MenuAction> = [
  { label: "Sửa", icon: Pencil, onSelect: () => undefined },
];

const addCustomerButton = <Button variant="primary">Thêm khách</Button>;

export function Gallery() {
  const toast = useToast();

  const showSaved = useCallback(() => toast.show({ title: "Đã lưu ghi chú" }), [toast]);

  const deleteSample = useCallback(() => {
    toast.show({
      title: "Đã xoá ghi chú",
      description: sampleNote,
      action: { label: "Hoàn tác", onAction: () => toast.show({ title: "Đã khôi phục ghi chú" }) },
    });
  }, [toast]);

  const deleteAction = useMemo<MenuAction>(
    () => ({ label: "Xoá", icon: Trash2, onSelect: deleteSample }),
    [deleteSample],
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>Components</h1>
        <p className={styles.lead}>
          Hover, focus and pressed states are live: use a mouse, the keyboard and a touch screen.
        </p>
      </header>

      <Section title="Button">
        <Sample caption="primary / secondary / quiet">
          <Button variant="primary">Lưu</Button>
          <Button>Huỷ</Button>
          <Button variant="quiet">Để sau</Button>
        </Sample>
        <Sample caption="tone danger: secondary, quiet. Primary has no danger tone">
          <Button tone="danger">
            <Trash2 />
            Xoá
          </Button>
          <Button variant="quiet" tone="danger">
            Xoá
          </Button>
        </Sample>
        <Sample caption="size lg (48px), for the main action and list rows">
          <Button variant="primary" size="lg">
            Ghi
          </Button>
          <Button size="lg">Huỷ</Button>
        </Sample>
        <Sample caption="disabled, always with the reason beneath">
          <div className={styles.stack}>
            <Button disabled focusableWhenDisabled aria-describedby="export-reason">
              Xuất Excel
            </Button>
            <p id="export-reason" className={styles.hint}>
              Chưa có đơn nào trong tháng này để xuất.
            </p>
          </div>
        </Sample>
        <Sample caption="IconButton: square, label read aloud; quiet, or primary for send">
          <IconButton icon={Ellipsis} label="Tuỳ chọn" />
          <IconButton icon={X} label="Đóng" />
          <IconButton icon={Trash2} label="Xoá" tone="danger" />
          <IconButton icon={Ellipsis} label="Tuỳ chọn" size="lg" />
          <IconButton icon={SendHorizontal} label="Ghi" variant="primary" size="lg" />
        </Sample>
      </Section>

      <Section title="TextArea">
        <Sample caption="empty: one line, grows as she types">
          <TextArea aria-label="Ghi chú" placeholder="Gõ đơn, việc cần nhắc, ghi chú..." />
        </Sample>
        <Sample caption="filled: grows to 8 lines, then scrolls">
          <TextArea
            aria-label="Ghi chú"
            defaultValue={`${sampleNote}\nHẹn thứ 6 ghé lại lấy đơn tiếp\nNhắc chị kế toán gửi hoá đơn`}
          />
        </Sample>
        <Sample caption="invalid, checked on submit only">
          <div className={styles.stack}>
            <TextArea aria-label="Ghi chú" aria-invalid="true" aria-describedby="note-error" />
            <p id="note-error" className={styles.error}>
              Chưa có nội dung
            </p>
          </div>
        </Sample>
        <Sample caption="disabled">
          <TextArea aria-label="Ghi chú" disabled defaultValue={sampleNote} />
        </Sample>
      </Section>

      <Section title="ActionMenu">
        <Sample caption="destructive item last, below a divider, in the danger color">
          <article className={styles.row}>
            <time className={styles.rowTime} dateTime="09:12">
              09:12
            </time>
            <p className={styles.rowText}>{sampleNote}</p>
            <ActionMenu
              label="Tuỳ chọn cho ghi chú"
              actions={sampleActions}
              destructive={deleteAction}
            />
          </article>
        </Sample>
      </Section>

      <Section title="Toast">
        <Sample caption="plain: 7 seconds. With an action: 10 seconds, closes when used">
          <Button onClick={showSaved}>Thông báo thường</Button>
          <Button onClick={deleteSample}>Có Hoàn tác</Button>
        </Sample>
      </Section>

      <Section title="EmptyState">
        <Sample caption="title says what is empty; description only if it helps">
          <div className={styles.frame}>
            <EmptyState
              title="Hôm nay chưa có ghi chú nào"
              description="Gõ vào ô phía trên, ghi chú sẽ hiện ở đây."
            />
          </div>
        </Sample>
        <Sample caption="with the action that fills it">
          <div className={styles.frame}>
            <EmptyState title="Chưa có khách nào" action={addCustomerButton} />
          </div>
        </Sample>
      </Section>
    </main>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function Sample({ caption, children }: { readonly caption: string; readonly children: ReactNode }) {
  return (
    <figure className={styles.sample}>
      <figcaption className={styles.caption}>{caption}</figcaption>
      <div className={styles.items}>{children}</div>
    </figure>
  );
}
