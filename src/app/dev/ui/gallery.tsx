"use client";

import { Ellipsis, LogOut, Pencil, Plus, SendHorizontal, Trash2, X } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { actionLabels, optionsFor } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { Button } from "@/shared/ui/button/button";
import { IconButton } from "@/shared/ui/button/icon-button";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { Dialog } from "@/shared/ui/dialog/dialog";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { List } from "@/shared/ui/list/list";
import { ListAction } from "@/shared/ui/list/list-action";
import { ListContent } from "@/shared/ui/list/list-content";
import { ListRow } from "@/shared/ui/list/list-row";
import { Status } from "@/shared/ui/status/status";
import { TextArea } from "@/shared/ui/text-area/text-area";
import { TextField } from "@/shared/ui/text-field/text-field";
import { useToast } from "@/shared/ui/toast/use-toast";

import styles from "./gallery.module.scss";

const sampleNote = "Giao 2 thùng giấy in cho cửa hàng Minh Tâm, thu 850.000đ";

const sampleActions: ReadonlyArray<MenuAction> = [
  { label: actionLabels.edit, icon: Pencil, onSelect: () => undefined },
];

const signOutSample: MenuAction = { label: "Đăng xuất", icon: LogOut, onSelect: () => undefined };

const addCustomerButton = <Button variant="primary">Thêm khách</Button>;

export function Gallery() {
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const showSaved = useCallback(() => toast.show({ title: "Đã lưu ghi chú" }), [toast]);

  const deleteSample = useCallback(() => {
    toast.show({
      title: "Đã xoá ghi chú",
      description: sampleNote,
      action: {
        label: actionLabels.undo,
        onAction: () => toast.show({ title: "Đã khôi phục ghi chú" }),
      },
    });
  }, [toast]);

  const deleteAction = useMemo<MenuAction>(
    () => ({ label: actionLabels.remove, icon: Trash2, onSelect: deleteSample }),
    [deleteSample],
  );

  const openDialog = useCallback(() => setDialogOpen(true), []);
  const closeDialog = useCallback(() => setDialogOpen(false), []);
  const openConfirm = useCallback(() => setConfirmOpen(true), []);
  const closeConfirm = useCallback(() => setConfirmOpen(false), []);

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
          <Button variant="primary">{actionLabels.save}</Button>
          <Button>{actionLabels.cancel}</Button>
          <Button variant="quiet">Để sau</Button>
        </Sample>
        <Sample caption="tone danger: secondary, quiet. Primary has no danger tone">
          <Button tone="danger">
            <Trash2 />
            {actionLabels.remove}
          </Button>
          <Button variant="quiet" tone="danger">
            {actionLabels.remove}
          </Button>
        </Sample>
        <Sample caption="size lg (48px), for the main action and list rows">
          <Button variant="primary" size="lg">
            Ghi
          </Button>
          <Button size="lg">{actionLabels.cancel}</Button>
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
          <IconButton icon={Ellipsis} label={actionLabels.options} />
          <IconButton icon={X} label="Đóng" />
          <IconButton icon={Trash2} label={actionLabels.remove} tone="danger" />
          <IconButton icon={Ellipsis} label={actionLabels.options} size="lg" />
          <IconButton icon={SendHorizontal} label="Ghi" variant="primary" size="lg" />
        </Sample>
      </Section>

      <Section title="TextArea">
        <Sample caption="empty: one line, grows while typing">
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

      <Section title="TextField">
        <Sample caption="with a hint beneath">
          <div className={styles.block}>
            <TextField
              label="Tên đăng nhập"
              defaultValue="lan"
              description="3-32 ký tự, chỉ gồm chữ không dấu, số và . _ -"
            />
          </div>
        </Sample>
        <Sample caption="password: shown on request, never asked twice">
          <div className={styles.block}>
            <TextField label="Mật khẩu" type="password" defaultValue="một câu dễ nhớ ở đây" />
          </div>
        </Sample>
        <Sample caption="invalid: the error sits under the field">
          <div className={styles.block}>
            <TextField label="Tên" defaultValue="" error="Chưa nhập tên" />
          </div>
        </Sample>
      </Section>

      <Section title="List">
        <Sample caption="heading, rows with a value and what it is, action rows, a note beneath">
          <div className={styles.block}>
            <List heading="Thiết bị đang đăng nhập" footer="Một dòng giải thích, khi cần.">
              <ListRow title="Chrome trên Android" detail="Thiết bị này" />
              <ListRow title="Safari trên iOS" detail="Dùng lần cuối 16:02 22/10">
                <ActionMenu label={optionsFor("Safari trên iOS")} destructive={signOutSample} />
              </ListRow>
              <ListRow title="Lan" detail="Tên">
                <Button variant="quiet">{actionLabels.edit}</Button>
              </ListRow>
              <ListAction label="Thêm Face ID hoặc vân tay" icon={Plus} />
              <ListAction label="Đăng xuất các thiết bị khác" icon={LogOut} tone="danger" />
            </List>
          </div>
        </Sample>
        <Sample caption="ListContent: a row opened into a field">
          <div className={styles.block}>
            <List>
              <ListContent>
                <TextField label="Tên" defaultValue="Lan" />
              </ListContent>
            </List>
          </div>
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
              label={optionsFor("ghi chú")}
              actions={sampleActions}
              destructive={deleteAction}
            />
          </article>
        </Sample>
      </Section>

      <Section title="Dialog">
        <Sample caption="a sheet at the bottom on a phone, a card in the middle from md">
          <Button onClick={openDialog}>Mở hộp thoại</Button>
          <Button tone="danger" onClick={openConfirm}>
            Xác nhận xoá
          </Button>
          <Dialog
            open={dialogOpen}
            onClose={closeDialog}
            title="Xác nhận lại"
            description="Dùng Face ID hoặc vân tay để tiếp tục."
          >
            <Button variant="primary" size="lg" onClick={closeDialog}>
              {actionLabels.confirm}
            </Button>
            <Button variant="quiet" onClick={closeDialog}>
              {actionLabels.cancel}
            </Button>
          </Dialog>
          <ConfirmDialog
            open={confirmOpen}
            title="Xoá Google Password Manager?"
            description="Sau khi xoá, không đăng nhập bằng nó được nữa."
            confirmLabel={actionLabels.remove}
            onConfirm={closeConfirm}
            onClose={closeConfirm}
          />
        </Sample>
      </Section>

      <Section title="Status">
        <Sample caption="one line for an outcome; keeps its height when empty">
          <div className={styles.block}>
            <Status message="Đã huỷ." />
            <Status message="Sai tên đăng nhập hoặc mật khẩu." tone="danger" />
          </div>
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
