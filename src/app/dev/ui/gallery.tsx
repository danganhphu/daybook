"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";

import { searchText } from "@/shared/domain/search-text";
import { actionLabels, optionsFor } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { Button } from "@/shared/ui/button/button";
import { ButtonLink } from "@/shared/ui/button/button-link";
import { IconButton } from "@/shared/ui/button/icon-button";
import { IconLink } from "@/shared/ui/button/icon-link";
import { ColumnChart, type ChartColumn } from "@/shared/ui/chart/column-chart";
import { ChipLinks } from "@/shared/ui/chip-links/chip-links";
import { DayPicker } from "@/shared/ui/day-picker/day-picker";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { Dialog } from "@/shared/ui/dialog/dialog";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { FilterChips } from "@/shared/ui/filter-chips/filter-chips";
import { iconTones } from "@/shared/ui/icon/icon-tone";
import {
  AddIcon,
  ArrowBackIcon,
  CloseIcon,
  DeleteIcon,
  EditIcon,
  Inventory2Icon,
  LocalShippingIcon,
  LogoutIcon,
  MoreHorizIcon,
  PaymentsIcon,
  PersonIcon,
  ReceiptLongIcon,
  SearchIcon,
  SendIcon,
  StickyNote2Icon,
} from "@/shared/ui/icon/icons";
import * as icons from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListAction } from "@/shared/ui/list/list-action";
import { ListBar } from "@/shared/ui/list/list-bar";
import { ListContent } from "@/shared/ui/list/list-content";
import { ListLink } from "@/shared/ui/list/list-link";
import { ListRow } from "@/shared/ui/list/list-row";
import { Notice } from "@/shared/ui/notice/notice";
import { PageHeader } from "@/shared/ui/page-header/page-header";
import { QuietLink } from "@/shared/ui/quiet-link/quiet-link";
import { SearchField } from "@/shared/ui/search-field/search-field";
import { SelectField } from "@/shared/ui/select-field/select-field";
import { Stats } from "@/shared/ui/stats/stats";
import { Status } from "@/shared/ui/status/status";
import { SuggestField } from "@/shared/ui/suggest-field/suggest-field";
import { TextArea } from "@/shared/ui/text-area/text-area";
import { TextField } from "@/shared/ui/text-field/text-field";
import { useToast } from "@/shared/ui/toast/use-toast";
import { shareOf } from "@/shared/web/chart-scale";
import { moneyText } from "@/shared/web/money-text";
import { routes } from "@/shared/web/routes";

import styles from "./gallery.module.scss";

const sampleNote = "Giao 2 hộp thuốc tê cho nha khoa Minh Tâm, thu 850.000đ";

const sampleActions: ReadonlyArray<MenuAction> = [
  { label: actionLabels.edit, icon: EditIcon, onSelect: () => undefined },
];

const signOutSample: MenuAction = {
  label: "Đăng xuất",
  icon: LogoutIcon,
  onSelect: () => undefined,
};

const addCustomerButton = <Button variant="primary">Thêm khách</Button>;

// Every generated icon, in the generator's order
const allIcons = Object.entries(icons);

const sampleDay = "2026-10-23";

const sampleKinds = [
  { value: "clinic", label: "Nha khoa" },
  { value: "agent", label: "Đại lý" },
];

const sampleStats = [
  { label: "Doanh số", value: "900.000đ" },
  { label: "Đã thu", value: "500.000đ" },
  { label: "Còn nợ", value: "400.000đ", tone: "danger" as const },
];

const sampleHero = {
  label: "Doanh số",
  value: "3.325.000đ",
  change: { text: "+12% so với tháng trước", direction: "up" as const },
};

// A week of sales, Monday first, on an axis up to 2.000.000đ
const sampleWeek = [
  { short: "T2", day: "Thứ Hai, 19/10", sales: 400_000, orders: 1 },
  { short: "T3", day: "Thứ Ba, 20/10", sales: 0, orders: 0 },
  { short: "T4", day: "Thứ Tư, 21/10", sales: 1_200_000, orders: 2 },
  { short: "T5", day: "Thứ Năm, 22/10", sales: 650_000, orders: 1 },
  { short: "T6", day: "Thứ Sáu, 23/10", sales: 800_000, orders: 1 },
  { short: "T7", day: "Thứ Bảy, 24/10", sales: 275_000, orders: 1 },
  { short: "CN", day: "Chủ Nhật, 25/10", sales: 0, orders: 0 },
];

const sampleColumns: ReadonlyArray<ChartColumn> = sampleWeek.map((each) => ({
  key: each.short,
  axisLabel: each.short,
  label: each.day,
  value: moneyText(each.sales),
  detail: `${each.orders} đơn`,
  share: shareOf(each.sales, 2_000_000),
}));

const sampleTicks = ["2tr", "1tr", "0"] as const;

const sampleTableHeads = ["Ngày", "Doanh số", "Số đơn"] as const;

const sampleFilters = [{ label: "Kim nha khoa", removeHref: routes.componentGallery }];

function removeSampleFilter(label: string) {
  return `Bỏ lọc ${label}`;
}

const sampleChips = [
  { label: "Tất cả", href: routes.componentGallery, current: true },
  { label: "Chưa giao", href: `${routes.componentGallery}?status=undelivered`, current: false },
  { label: "Còn nợ", href: `${routes.componentGallery}?status=owed`, current: false },
];

type SampleProduct = { readonly id: string; readonly name: string; readonly price: string };

const sampleProducts: ReadonlyArray<SampleProduct> = [
  { id: "1", name: "Thuốc tê Lidocaine", price: "425.000đ" },
  { id: "2", name: "Găng tay y tế", price: "95.000đ" },
  { id: "3", name: "Ống hút nước bọt", price: "5.000đ" },
];

// The server's search, played locally: every word typed, without accents
async function suggestSamples(text: string): Promise<ReadonlyArray<SampleProduct>> {
  const words = searchText(text).split(" ");
  return sampleProducts.filter((product) =>
    words.every((word) => searchText(product.name).includes(word)),
  );
}

function describeSample(product: SampleProduct) {
  return { key: product.id, label: product.name, detail: product.price };
}

const sampleMenu = <ActionMenu label={actionLabels.options} actions={sampleActions} />;

export function Gallery() {
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const showSaved = useCallback(() => toast.show({ title: "Đã lưu ghi chú" }), [toast]);
  const pickSampleDay = useCallback((day: string) => toast.show({ title: day }), [toast]);
  const [sampleProduct, setSampleProduct] = useState("");
  const pickSample = useCallback(
    (product: SampleProduct) => toast.show({ title: product.name }),
    [toast],
  );

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
    () => ({ label: actionLabels.remove, icon: DeleteIcon, onSelect: deleteSample }),
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
            <DeleteIcon />
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
          <IconButton icon={MoreHorizIcon} label={actionLabels.options} />
          <IconButton icon={CloseIcon} label="Đóng" />
          <IconButton icon={DeleteIcon} label={actionLabels.remove} tone="danger" />
          <IconButton icon={MoreHorizIcon} label={actionLabels.options} size="lg" />
          <IconButton icon={SendIcon} label="Ghi" variant="primary" size="lg" />
        </Sample>
        <Sample caption="IconLink: looks like a quiet IconButton, goes to another page, read as a link">
          <IconLink icon={ArrowBackIcon} label={actionLabels.back} href={routes.componentGallery} />
          <IconLink icon={SearchIcon} label="Tìm ghi chú" href={routes.componentGallery} />
        </Sample>
      </Section>

      <Section title="Icons">
        <Sample caption="Material Symbols Rounded: outlined, then filled for the current tab and a row's icon">
          <ul className={styles.icons}>
            {allIcons.map(([name, Icon]) => (
              <li key={name} className={styles.icon}>
                <span className={styles.iconForms}>
                  <Icon />
                  <Icon filled />
                </span>
                <span className={styles.iconName}>{name}</span>
              </li>
            ))}
          </ul>
        </Sample>
        <Sample caption="tones: one colour per meaning, the same on every screen">
          <div className={styles.block}>
            <List>
              <ListRow
                title="850.000đ"
                detail="money"
                icon={PaymentsIcon}
                iconTone={iconTones.money}
              />
              <ListRow
                title="Hướng Dương"
                detail="customer"
                icon={PersonIcon}
                iconTone={iconTones.customer}
              />
              <ListRow
                title="Còn nợ 800.000đ"
                detail="owed"
                icon={ReceiptLongIcon}
                iconTone={iconTones.owed}
              />
              <ListRow
                title={actionLabels.remove}
                detail="danger"
                icon={DeleteIcon}
                iconTone={iconTones.danger}
              />
              <ListRow
                title="Đã giao"
                detail="delivery"
                icon={LocalShippingIcon}
                iconTone={iconTones.delivery}
              />
              <ListRow
                title="Giao trước 10 giờ"
                detail="note"
                icon={StickyNote2Icon}
                iconTone={iconTones.note}
              />
              <ListRow
                title="Kim nha khoa"
                detail="item"
                icon={Inventory2Icon}
                iconTone={iconTones.item}
              />
            </List>
          </div>
        </Sample>
      </Section>

      <Section title="SearchField">
        <Sample caption="a pill with a magnifier; the browser adds the clear button">
          <SearchField label="Tìm ghi chú" placeholder="Tìm ghi chú" defaultValue="minh tam" />
        </Sample>
      </Section>

      <Section title="PageHeader, ButtonLink, Stats">
        <Sample caption="back, title and subtitle, actions; buttons that go somewhere; a summary in one card">
          <div className={styles.stack}>
            <PageHeader
              title="Hướng Dương"
              subtitle="Nha khoa, Quận 3"
              back={routes.componentGallery}
              actions={sampleMenu}
            />
            <ButtonLink href={routes.componentGallery} variant="primary">
              <AddIcon aria-hidden />
              Tạo đơn
            </ButtonLink>
            <Stats label="Tháng 10/2026" items={sampleStats} />
            <Stats label="Tháng 10/2026" hero={sampleHero} items={sampleStats} />
          </div>
        </Sample>
      </Section>

      <Section title="ColumnChart, ListBar, FilterChips">
        <Sample caption="tap, drag or use the arrow keys on the plot, the table has every value; a filter in force; ranking rows, the last one not a link">
          <div className={styles.stack}>
            <ColumnChart
              heading="Doanh số theo ngày"
              columns={sampleColumns}
              ticks={sampleTicks}
              peak={2}
              peakLabel="Cao nhất"
              tableLabel="Xem dạng bảng"
              tableHeads={sampleTableHeads}
            />
            <FilterChips label="Đang lọc" chips={sampleFilters} removeLabel={removeSampleFilter} />
            <List heading="Sản phẩm bán chạy" footer="Các sản phẩm khác: 45.000đ">
              <ListBar
                title="Thuốc tê Lidocaine"
                detail="Số lượng 3"
                value="1.220.000đ"
                share={100}
                href={routes.componentGallery}
              />
              <ListBar
                title="Găng tay y tế"
                detail="Số lượng 6"
                value="600.000đ"
                share={49}
                href={routes.componentGallery}
              />
              <ListBar title="Bông gòn" detail="Số lượng 12" value="60.000đ" share={5} />
            </List>
          </div>
        </Sample>
      </Section>

      <Section title="ChipLinks, ListLink">
        <Sample caption="one filter at a time, as links; a row that opens a page, with what is owed in red">
          <div className={styles.stack}>
            <ChipLinks label="Lọc" chips={sampleChips} />
            <List>
              <ListLink
                href={routes.componentGallery}
                title="Hướng Dương"
                detail="Nha khoa, Quận 3"
                value="Còn nợ 400.000đ"
                valueTone="danger"
              />
              <ListLink href={routes.componentGallery} title="Sao Mai" value="900.000đ" />
            </List>
          </div>
        </Sample>
      </Section>

      <Section title="SuggestField">
        <Sample caption="free text, with suggestions as it is typed (try thuoc); nothing found is said under it">
          <SuggestField
            label="Sản phẩm"
            value={sampleProduct}
            onValueChange={setSampleProduct}
            suggest={suggestSamples}
            describe={describeSample}
            onPick={pickSample}
            placeholder="Gõ tên sản phẩm"
            emptyText="Sản phẩm mới, sẽ được thêm khi lưu đơn."
          />
        </Sample>
      </Section>

      <Section title="SelectField">
        <Sample caption="the browser's own select: the phone's picker opens; an empty first choice when none is fine">
          <SelectField
            label="Loại khách"
            emptyLabel="Không chọn"
            options={sampleKinds}
            defaultValue=""
          />
        </Sample>
      </Section>

      <Section title="DayPicker">
        <Sample caption="an icon that opens the phone's own date picker">
          <DayPicker label="Chọn ngày" day={sampleDay} max={sampleDay} onPick={pickSampleDay} />
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
              <ListAction label="Thêm Face ID hoặc vân tay" icon={AddIcon} />
              <ListAction label="Đăng xuất các thiết bị khác" icon={LogoutIcon} tone="danger" />
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
            CloseIconác nhận xoá
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

      <Section title="Notice">
        <Sample caption="a record's state, first on its page; muted, with the way onward">
          <div className={styles.block}>
            <Notice message="Sản phẩm này đã gộp vào sản phẩm khác.">
              <ButtonLink href="#notice">Xem bản giữ lại</ButtonLink>
            </Notice>
          </div>
        </Sample>
        <Sample caption="danger, with the way back; and alone">
          <div className={styles.block}>
            <Notice message="Đơn này đã bị xoá." tone="danger">
              <Button>Khôi phục</Button>
            </Notice>
            <Notice message="Sản phẩm này đang ẩn: không hiện khi ghi đơn, đơn cũ vẫn giữ." />
          </div>
        </Sample>
      </Section>

      <Section title="QuietLink">
        <Sample caption="something rarely needed, centred under a list">
          <div className={styles.block}>
            <QuietLink href="#quiet-link">Khách đã ẩn</QuietLink>
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
