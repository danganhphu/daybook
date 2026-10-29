import type { Temporal } from "temporal-polyfill/implementation";

import { accountOverview } from "@/features/access/application/account-overview";
import { authenticate } from "@/features/access/application/authenticate";
import { beginPasswordChange } from "@/features/access/application/begin-password-change";
import { beginPasswordSignIn } from "@/features/access/application/begin-password-sign-in";
import { changeDisplayName } from "@/features/access/application/change-display-name";
import { changeUsername } from "@/features/access/application/change-username";
import { endOtherSessions } from "@/features/access/application/end-other-sessions";
import { endPersonSessions } from "@/features/access/application/end-person-sessions";
import { endSession } from "@/features/access/application/end-session";
import {
  finishAddingPasskey,
  type FinishAddingPasskeyRequest,
} from "@/features/access/application/finish-adding-passkey";
import {
  finishPasskeySetup,
  type FinishPasskeySetupRequest,
} from "@/features/access/application/finish-passkey-setup";
import {
  finishPasskeySignIn,
  type FinishPasskeySignInRequest,
} from "@/features/access/application/finish-passkey-sign-in";
import {
  finishPasswordChange,
  type FinishPasswordChangeRequest,
} from "@/features/access/application/finish-password-change";
import {
  finishPasswordSignIn,
  type FinishPasswordSignInRequest,
} from "@/features/access/application/finish-password-sign-in";
import { issueInvite } from "@/features/access/application/issue-invite";
import { issueRecoveryLink } from "@/features/access/application/issue-recovery-link";
import { listSessions } from "@/features/access/application/list-sessions";
import {
  nameInvitedAccount,
  type NameInvitedAccountRequest,
} from "@/features/access/application/name-invited-account";
import type { Peppers } from "@/features/access/application/peppers";
import { redeemSetupLink } from "@/features/access/application/redeem-setup-link";
import { removePasskey } from "@/features/access/application/remove-passkey";
import { resumeSetup } from "@/features/access/application/resume-setup";
import { signOut } from "@/features/access/application/sign-out";
import { startAddingPasskey } from "@/features/access/application/start-adding-passkey";
import { startPasskeySetup } from "@/features/access/application/start-passkey-setup";
import {
  startPasskeySignIn,
  type StartPasskeySignInRequest,
} from "@/features/access/application/start-passkey-sign-in";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { DisplayName, Username } from "@/features/access/domain/account";
import type { Session } from "@/features/access/domain/session";
import { createAccessEventRepository } from "@/features/access/infrastructure/access-event-repository";
import { createAccountRepository } from "@/features/access/infrastructure/account-repository";
import { createCeremonyRepository } from "@/features/access/infrastructure/ceremony-repository";
import { createRateLimiter } from "@/features/access/infrastructure/d1-rate-limiter";
import { createLazyPasskeyVerifier } from "@/features/access/infrastructure/lazy-passkey-verifier";
import { createPasskeyRepository } from "@/features/access/infrastructure/passkey-repository";
import { createPasswordRepository } from "@/features/access/infrastructure/password-repository";
import type { RelyingParty } from "@/features/access/infrastructure/relying-party";
import { createSessionRepository } from "@/features/access/infrastructure/session-repository";
import { createSetupLinkRepository } from "@/features/access/infrastructure/setup-link-repository";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import {
  changeQuietAfterDays,
  type ChangeQuietAfterDaysInput,
} from "@/features/book-settings/application/change-quiet-after-days";
import { createBookSettingRepository } from "@/features/book-settings/infrastructure/book-setting-repository";
import {
  recordCapture,
  type RecordCaptureInput,
} from "@/features/capture/application/record-capture";
import type { CaptureId } from "@/features/capture/domain/capture";
import { createCaptureRepository } from "@/features/capture/infrastructure/capture-repository";
import { addCustomer, type AddCustomerInput } from "@/features/customers/application/add-customer";
import {
  addCustomerKind,
  type AddCustomerKindInput,
} from "@/features/customers/application/add-customer-kind";
import { archiveCustomer } from "@/features/customers/application/archive-customer";
import { archiveCustomerKind } from "@/features/customers/application/archive-customer-kind";
import {
  addCustomerAlias,
  removeCustomerAlias,
  type AddCustomerAliasInput,
} from "@/features/customers/application/customer-aliases";
import { listCustomers } from "@/features/customers/application/list-customers";
import {
  renameCustomerKind,
  type RenameCustomerKindInput,
} from "@/features/customers/application/rename-customer-kind";
import { restoreCustomer } from "@/features/customers/application/restore-customer";
import { restoreCustomerKind } from "@/features/customers/application/restore-customer-kind";
import {
  reviseCustomer,
  type ReviseCustomerInput,
} from "@/features/customers/application/revise-customer";
import type { CustomerId } from "@/features/customers/domain/customer";
import type { CustomerAliasId } from "@/features/customers/domain/customer-alias";
import type { CustomerKindId } from "@/features/customers/domain/customer-kind";
import type { CustomerFilter } from "@/features/customers/domain/customer-repository";
import { createCustomerKindRepository } from "@/features/customers/infrastructure/customer-kind-repository";
import { createCustomerRepository } from "@/features/customers/infrastructure/customer-repository";
import { mergeCustomers } from "@/features/merging/application/merge-customers";
import {
  customerMergePreview,
  productMergePreview,
} from "@/features/merging/application/merge-preview";
import { mergeProducts } from "@/features/merging/application/merge-products";
import type { MergeInput, MergingDeps } from "@/features/merging/application/merging-deps";
import { deleteNote } from "@/features/notes/application/delete-note";
import { editNote, type EditNoteInput } from "@/features/notes/application/edit-note";
import { listNotesForDay } from "@/features/notes/application/list-notes-for-day";
import type { NoteChange } from "@/features/notes/application/note-change";
import { restoreNote } from "@/features/notes/application/restore-note";
import { searchNotes } from "@/features/notes/application/search-notes";
import { createNoteRepository } from "@/features/notes/infrastructure/note-repository";
import {
  changeNotificationTimes,
  type ChangeNotificationTimesInput,
} from "@/features/notifications/application/change-notification-times";
import {
  markInboxRead,
  notificationInbox,
} from "@/features/notifications/application/notification-inbox";
import { notificationSettings } from "@/features/notifications/application/notification-settings";
import {
  subscribeDevice,
  type SubscribeDeviceInput,
} from "@/features/notifications/application/subscribe-device";
import { unsubscribeDevice } from "@/features/notifications/application/unsubscribe-device";
import { createInboxRepository } from "@/features/notifications/infrastructure/inbox-repository";
import { createNotificationPreferenceRepository } from "@/features/notifications/infrastructure/notification-preference-repository";
import { createPushSubscriptionRepository } from "@/features/notifications/infrastructure/push-subscription-repository";
import { deleteOrder, restoreOrder } from "@/features/orders/application/delete-order";
import {
  deliverOrder,
  undeliverOrder,
  type DeliverOrderInput,
} from "@/features/orders/application/deliver-order";
import type { OrderFilter } from "@/features/orders/application/order-queries";
import {
  addPayment,
  removePayment,
  type AddPaymentInput,
  type RemovePaymentInput,
} from "@/features/orders/application/payments";
import { placeOrder, type PlaceOrderInput } from "@/features/orders/application/place-order";
import { reviseOrder, type ReviseOrderInput } from "@/features/orders/application/revise-order";
import type { OrderId } from "@/features/orders/domain/order";
import { createOrderQueries } from "@/features/orders/infrastructure/order-queries";
import { createOrderRepository } from "@/features/orders/infrastructure/order-repository";
import { addProduct, type AddProductInput } from "@/features/products/application/add-product";
import { archiveProduct, restoreProduct } from "@/features/products/application/archive-product";
import { listProducts } from "@/features/products/application/list-products";
import {
  addProductAlias,
  removeProductAlias,
  type AddProductAliasInput,
} from "@/features/products/application/product-aliases";
import {
  renameProduct,
  type RenameProductInput,
} from "@/features/products/application/rename-product";
import type { ProductId } from "@/features/products/domain/product";
import type { ProductAliasId } from "@/features/products/domain/product-alias";
import type { ProductFilter } from "@/features/products/domain/product-repository";
import { createProductRepository } from "@/features/products/infrastructure/product-repository";
import {
  answerReading,
  type AnswerReadingInput,
} from "@/features/reading/application/answer-reading";
import type { MessageReader } from "@/features/reading/application/message-reader";
import { readNote, type ReadNoteInput } from "@/features/reading/application/read-note";
import type { ReadingDeps } from "@/features/reading/application/reading-deps";
import { readingStates } from "@/features/reading/application/reading-states";
import { createInterpretationRepository } from "@/features/reading/infrastructure/interpretation-repository";
import { addReminder, type AddReminderInput } from "@/features/reminders/application/add-reminder";
import {
  completeReminder,
  reopenReminder,
} from "@/features/reminders/application/complete-reminder";
import { deleteReminder, restoreReminder } from "@/features/reminders/application/delete-reminder";
import {
  reviseReminder,
  type ReviseReminderInput,
} from "@/features/reminders/application/revise-reminder";
import type { ReminderId } from "@/features/reminders/domain/reminder";
import type {
  DoneCursor,
  OpenReminderFilter,
} from "@/features/reminders/domain/reminder-repository";
import { createReminderRepository } from "@/features/reminders/infrastructure/reminder-repository";
import { readReport, type ReportRequest } from "@/features/reports/application/read-report";
import { createReportQueries } from "@/features/reports/infrastructure/report-queries";
import type { Clock } from "@/shared/application/clock";
import type { RecordChange } from "@/shared/application/record-change";
import type { AccountId } from "@/shared/domain/account-id";
import type { SearchTerm } from "@/shared/domain/search-term";
import { vietnamDate } from "@/shared/domain/vietnam-day";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import { systemClock } from "@/shared/infrastructure/system-clock";

import { createUnitOfWork } from "./unit-of-work";

export type App = ReturnType<typeof createApp>;

// What the app runs on: the database, who the passkeys belong to, the pepper for passwords, and what reads messages -
// none where no model is bound, and then notes stay notes. Push is available where its keys are set.
export type AppBindings = {
  readonly db: D1Database;
  readonly relyingParty: RelyingParty;
  readonly peppers: Peppers;
  readonly reader?: MessageReader | undefined;
  readonly pushAvailable?: boolean | undefined;
};

// The composition root: the one place that knows which implementation stands behind each port.
// Adapters - the web app, the Telegram bot - receive an App and never reach past it.
export function createApp(bindings: AppBindings, clock: Clock = systemClock) {
  const db = createDatabase(bindings.db);
  const notes = createNoteRepository(db);
  const kinds = createCustomerKindRepository(db);
  const customers = createCustomerRepository(db);
  const products = createProductRepository(db);
  const orders = createOrderRepository(db);
  const orderQueries = createOrderQueries(db);
  const reportQueries = createReportQueries(db);
  const reminders = createReminderRepository(db);
  const captures = createCaptureRepository(db);
  const interpretations = createInterpretationRepository(db);
  const accounts = createAccountRepository(db);
  const ceremonies = createCeremonyRepository(db);
  const passkeys = createPasskeyRepository(db);
  const passwords = createPasswordRepository(db);
  const sessions = createSessionRepository(db);
  const setupLinks = createSetupLinkRepository(db);
  const rateLimiter = createRateLimiter(db);
  const accessEvents = createAccessEventRepository(db);
  const bookSettings = createBookSettingRepository(db);
  const verifier = createLazyPasskeyVerifier(bindings.relyingParty);
  const secrets = webCryptoSecrets;
  const startUnitOfWork = () => createUnitOfWork(db);
  const access = {
    clock,
    secrets,
    accounts,
    ceremonies,
    passkeys,
    passwords,
    peppers: bindings.peppers,
    sessions,
    setupLinks,
    rateLimiter,
    accessEvents,
    verifier,
    startUnitOfWork,
  };
  const customerKinds = { clock, kinds, startUnitOfWork };
  const customerBook = { clock, customers, kinds, startUnitOfWork };
  const customerNames = { clock, customers, startUnitOfWork };
  const productBook = { clock, products, startUnitOfWork };
  const merging: MergingDeps = { clock, customers, products, orders, reminders, startUnitOfWork };
  const orderBook = { clock, orders, customers, products, startUnitOfWork };
  const reminderBook = { clock, reminders, customers, notes, startUnitOfWork };
  const reports = {
    queries: reportQueries,
    settings: bookSettings,
    today: () => vietnamDate(clock()),
  };
  const notifications = {
    clock,
    pushAvailable: bindings.pushAvailable ?? false,
    subscriptions: createPushSubscriptionRepository(db),
    preferences: createNotificationPreferenceRepository(db),
    startUnitOfWork,
  };
  const inbox = { clock, inbox: createInboxRepository(db), startUnitOfWork };
  const reading: ReadingDeps = {
    clock,
    reader: bindings.reader,
    notes,
    captures,
    interpretations,
    customers,
    products,
    orderQueries,
    reminders,
    startUnitOfWork,
  };

  return {
    recordCapture: (input: RecordCaptureInput) => recordCapture({ clock, startUnitOfWork }, input),
    editNote: (input: EditNoteInput) => editNote({ clock, notes, startUnitOfWork }, input),
    deleteNote: (input: NoteChange) => deleteNote({ clock, notes, startUnitOfWork }, input),
    restoreNote: (input: NoteChange) => restoreNote({ clock, notes, startUnitOfWork }, input),
    listNotesForDay: (day: Temporal.PlainDate) => listNotesForDay({ notes }, day),
    searchNotes: (term: SearchTerm) => searchNotes({ notes }, term),
    // The user's day in Vietnam by the injected clock, so it can be tested either side of midnight
    today: () => vietnamDate(clock()),
    now: () => clock(),

    listCustomerKinds: () => kinds.list(),
    addCustomerKind: (input: AddCustomerKindInput) => addCustomerKind(customerKinds, input),
    renameCustomerKind: (input: RenameCustomerKindInput) =>
      renameCustomerKind(customerKinds, input),
    archiveCustomerKind: (input: RecordChange<CustomerKindId>) =>
      archiveCustomerKind(customerKinds, input),
    restoreCustomerKind: (input: RecordChange<CustomerKindId>) =>
      restoreCustomerKind(customerKinds, input),
    getCustomer: (id: CustomerId) => customers.get(id),
    getCustomers: (ids: ReadonlyArray<CustomerId>) => customers.getMany(ids),
    listCustomers: (filter: CustomerFilter) => listCustomers({ customers }, filter),
    addCustomer: (input: AddCustomerInput) => addCustomer(customerBook, input),
    reviseCustomer: (input: ReviseCustomerInput) => reviseCustomer(customerBook, input),
    archiveCustomer: (input: RecordChange<CustomerId>) => archiveCustomer(customerBook, input),
    restoreCustomer: (input: RecordChange<CustomerId>) => restoreCustomer(customerBook, input),
    customerAliases: async (id: CustomerId) => (await customers.aliasesOf([id])).get(id) ?? [],
    addCustomerAlias: (input: AddCustomerAliasInput) => addCustomerAlias(customerNames, input),
    removeCustomerAlias: (id: CustomerAliasId) => removeCustomerAlias(customerNames, id),

    searchProducts: (term: SearchTerm, limit: number) => products.search(term, limit),
    getProduct: (id: ProductId) => products.get(id),
    getProducts: (ids: ReadonlyArray<ProductId>) => products.getMany(ids),
    listProducts: (filter: ProductFilter) => listProducts({ products }, filter),
    productUsage: () => orderQueries.productUsage(),
    addProduct: (input: AddProductInput) => addProduct(productBook, input),
    renameProduct: (input: RenameProductInput) => renameProduct(productBook, input),
    archiveProduct: (input: RecordChange<ProductId>) => archiveProduct(productBook, input),
    restoreProduct: (input: RecordChange<ProductId>) => restoreProduct(productBook, input),
    productAliases: (id: ProductId) => products.aliasesOf(id),
    addProductAlias: (input: AddProductAliasInput) => addProductAlias(productBook, input),
    removeProductAlias: (id: ProductAliasId) => removeProductAlias(productBook, id),

    customerMergePreview: (from: CustomerId) => customerMergePreview(merging, from),
    mergeCustomers: (input: MergeInput<CustomerId>) => mergeCustomers(merging, input),
    productMergePreview: (from: ProductId) => productMergePreview(merging, from),
    mergeProducts: (input: MergeInput<ProductId>) => mergeProducts(merging, input),
    lastPrices: (ids: ReadonlyArray<ProductId>, customerId: CustomerId | undefined) =>
      orderQueries.lastPrices(ids, customerId),

    // Who is who in a change log: the two people's names, by account
    displayNames: async () =>
      new Map((await accounts.list()).map((account) => [account.id, account.displayName])),
    getOrder: (id: OrderId) => orders.get(id),
    orderHistory: (id: OrderId) => orderQueries.history(id),
    listOrders: (filter: OrderFilter, limit: number) => orderQueries.list(filter, limit),
    orderTotals: (filter: OrderFilter) => orderQueries.totals(filter),
    owedByCustomer: () => orderQueries.owedByCustomer(),
    customerAccount: (id: CustomerId) => orderQueries.customerAccount(id),
    placeOrder: (input: PlaceOrderInput) => placeOrder(orderBook, input),
    reviseOrder: (input: ReviseOrderInput) => reviseOrder(orderBook, input),
    deliverOrder: (input: DeliverOrderInput) => deliverOrder(orderBook, input),
    undeliverOrder: (input: RecordChange<OrderId>) => undeliverOrder(orderBook, input),
    addPayment: (input: AddPaymentInput) => addPayment(orderBook, input),
    removePayment: (input: RemovePaymentInput) => removePayment(orderBook, input),
    deleteOrder: (input: RecordChange<OrderId>) => deleteOrder(orderBook, input),
    restoreOrder: (input: RecordChange<OrderId>) => restoreOrder(orderBook, input),
    listDeletedOrders: (since: Temporal.Instant, limit: number) =>
      orderQueries.listDeleted(since, limit),
    listDeletedNotes: (since: Temporal.Instant, limit: number) => notes.listDeleted(since, limit),

    readReport: (request: ReportRequest) => readReport(reports, request),
    bookSetting: () => bookSettings.get(),
    changeQuietAfterDays: (input: ChangeQuietAfterDaysInput) =>
      changeQuietAfterDays({ clock, settings: bookSettings, startUnitOfWork }, input),

    getReminder: (id: ReminderId) => reminders.get(id),
    listOpenReminders: (filter: OpenReminderFilter, limit: number) =>
      reminders.listOpen(filter, limit),
    listDoneReminders: (after: DoneCursor | undefined, limit: number) =>
      reminders.listDone(after, limit),
    listDeletedReminders: (since: Temporal.Instant, limit: number) =>
      reminders.listDeleted(since, limit),
    addReminder: (input: AddReminderInput) => addReminder(reminderBook, input),
    reviseReminder: (input: ReviseReminderInput) => reviseReminder(reminderBook, input),
    completeReminder: (input: RecordChange<ReminderId>) => completeReminder(reminderBook, input),
    reopenReminder: (input: RecordChange<ReminderId>) => reopenReminder(reminderBook, input),
    deleteReminder: (input: RecordChange<ReminderId>) => deleteReminder(reminderBook, input),
    restoreReminder: (input: RecordChange<ReminderId>) => restoreReminder(reminderBook, input),

    // Whether notes can be read here, so a screen offers to read again only where it can
    canRead: () => bindings.reader !== undefined,
    readNote: (input: ReadNoteInput) => readNote(reading, input),
    answerReading: (input: AnswerReadingInput) => answerReading(reading, input),
    readingStates: (captureIds: ReadonlyArray<CaptureId>) => readingStates(reading, captureIds),

    authenticate: (cookie: string | undefined) => authenticate(access, cookie),
    redeemSetupLink: (token: string, origin: RequestOrigin) =>
      redeemSetupLink(access, token, origin),
    startPasskeySetup: (ceremonyCookie: string | undefined) =>
      startPasskeySetup(access, ceremonyCookie),
    finishPasskeySetup: (request: FinishPasskeySetupRequest) => finishPasskeySetup(access, request),
    startPasskeySignIn: (request: StartPasskeySignInRequest) => startPasskeySignIn(access, request),
    finishPasskeySignIn: (request: FinishPasskeySignInRequest) =>
      finishPasskeySignIn(access, request),
    beginPasswordSignIn: (username: unknown, origin: RequestOrigin) =>
      beginPasswordSignIn(access, { username, origin }),
    finishPasswordSignIn: (request: FinishPasswordSignInRequest) =>
      finishPasswordSignIn(access, request),
    beginPasswordChange: (session: Session) => beginPasswordChange(access, session),
    finishPasswordChange: (session: Session, request: FinishPasswordChangeRequest) =>
      finishPasswordChange(access, session, request),
    signOut: (session: Session, origin: RequestOrigin) =>
      signOut({ clock, startUnitOfWork }, session, origin),
    endOtherSessions: (session: Session, origin: RequestOrigin) =>
      endOtherSessions(access, session, origin),
    listSessions: (accountId: AccountId) => listSessions({ clock, sessions }, accountId),
    accountOverview: (accountId: AccountId) => accountOverview(access, accountId),
    changeDisplayName: (session: Session, displayName: DisplayName, origin: RequestOrigin) =>
      changeDisplayName(access, session, displayName, origin),
    changeUsername: (session: Session, username: Username, origin: RequestOrigin) =>
      changeUsername(access, session, username, origin),
    startAddingPasskey: (session: Session) => startAddingPasskey(access, session),
    finishAddingPasskey: (session: Session, request: FinishAddingPasskeyRequest) =>
      finishAddingPasskey(access, session, request),
    removePasskey: (session: Session, passkeyId: unknown, origin: RequestOrigin) =>
      removePasskey(access, session, passkeyId, origin),
    endSession: (session: Session, otherId: unknown, origin: RequestOrigin) =>
      endSession(access, session, otherId, origin),
    endPersonSessions: (session: Session, accountId: unknown, origin: RequestOrigin) =>
      endPersonSessions(access, session, accountId, origin),
    issueInvite: (session: Session, origin: RequestOrigin) => issueInvite(access, session, origin),
    issueRecoveryLink: (session: Session, accountId: unknown, origin: RequestOrigin) =>
      issueRecoveryLink(access, session, accountId, origin),
    nameInvitedAccount: (request: NameInvitedAccountRequest) => nameInvitedAccount(access, request),
    resumeSetup: (ceremonyCookie: string | undefined) => resumeSetup(access, ceremonyCookie),

    notificationSettings: (session: Session) => notificationSettings(notifications, session),
    subscribeDevice: (session: Session, input: SubscribeDeviceInput, origin: RequestOrigin) =>
      subscribeDevice(notifications, session, input, origin),
    unsubscribeDevice: (session: Session, subscriptionId: unknown, origin: RequestOrigin) =>
      unsubscribeDevice(notifications, session, subscriptionId, origin),
    changeNotificationTimes: (session: Session, input: ChangeNotificationTimesInput) =>
      changeNotificationTimes(notifications, session, input),
    notificationInbox: (session: Session) => notificationInbox(inbox, session),
    unreadNotifications: (session: Session) => inbox.inbox.unreadCount(session.accountId),
    markInboxRead: (session: Session, upTo: Temporal.Instant) =>
      markInboxRead(inbox, session, upTo),
  } as const;
}
