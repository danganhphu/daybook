-- Edited by hand: STRICT; the audit triggers on sales_order and product (ADR 0011, decision 9); order_change
-- append-only (decision 10); a payment's update may only set its removal. Lines carry no triggers: they are
-- replaced whole under the order's version. schema.test.ts and audited-tables.test.ts fail if any goes missing.
CREATE TABLE `order_change` (
	`id` text PRIMARY KEY,
	`order_id` text NOT NULL,
	`kind` text NOT NULL,
	`changed_at` integer NOT NULL,
	`changed_by` text NOT NULL,
	`before` text,
	`after` text NOT NULL,
	CONSTRAINT `fk_order_change_order_id_sales_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `sales_order`(`id`),
	CONSTRAINT `fk_order_change_changed_by_account_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `account`(`id`),
	CONSTRAINT "order_change_kind_known" CHECK("kind" in ('placed', 'revised', 'delivered', 'undelivered', 'payment_added', 'payment_removed', 'deleted', 'restored')),
	CONSTRAINT "order_change_json" CHECK(json_valid("after") and ("before" is null or json_valid("before")))
) STRICT;
--> statement-breakpoint
CREATE TABLE `order_line` (
	`order_id` text NOT NULL,
	`position` integer NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	CONSTRAINT `order_line_pk` PRIMARY KEY(`order_id`, `position`),
	CONSTRAINT `fk_order_line_order_id_sales_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `sales_order`(`id`),
	CONSTRAINT `fk_order_line_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`),
	CONSTRAINT "order_line_position_range" CHECK("position" between 0 and 49),
	CONSTRAINT "order_line_quantity_range" CHECK("quantity" between 1 and 100000),
	CONSTRAINT "order_line_price_range" CHECK("unit_price" between 0 and 1000000000000)
) STRICT;
--> statement-breakpoint
CREATE TABLE `payment` (
	`id` text PRIMARY KEY,
	`order_id` text NOT NULL,
	`amount` integer NOT NULL,
	`paid_on` text NOT NULL,
	`method` text,
	`note` text,
	`recorded_at` integer NOT NULL,
	`recorded_by` text NOT NULL,
	`deleted_at` integer,
	`deleted_by` text,
	CONSTRAINT `fk_payment_order_id_sales_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `sales_order`(`id`),
	CONSTRAINT `fk_payment_recorded_by_account_id_fk` FOREIGN KEY (`recorded_by`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_payment_deleted_by_account_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `account`(`id`),
	CONSTRAINT "payment_amount_range" CHECK("amount" between 1 and 1000000000000),
	CONSTRAINT "payment_paid_on_day" CHECK("paid_on" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "payment_method_known" CHECK("method" is null or "method" in ('cash', 'transfer')),
	CONSTRAINT "payment_note_length" CHECK("note" is null or length("note") between 1 and 1000),
	CONSTRAINT "payment_deletion_whole" CHECK(("deleted_at" is null) = ("deleted_by" is null))
) STRICT;
--> statement-breakpoint
CREATE TABLE `sales_order` (
	`id` text PRIMARY KEY,
	`customer_id` text NOT NULL,
	`ordered_on` text NOT NULL,
	`delivered_on` text,
	`note` text,
	`capture_id` text,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by` text,
	CONSTRAINT `fk_sales_order_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`),
	CONSTRAINT `fk_sales_order_capture_id_capture_id_fk` FOREIGN KEY (`capture_id`) REFERENCES `capture`(`id`),
	CONSTRAINT `fk_sales_order_created_by_account_id_fk` FOREIGN KEY (`created_by`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_sales_order_updated_by_account_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_sales_order_deleted_by_account_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `account`(`id`),
	CONSTRAINT "sales_order_ordered_on_day" CHECK("ordered_on" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "sales_order_delivered_on_day" CHECK("delivered_on" is null or ("delivered_on" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]' and "delivered_on" >= "ordered_on")),
	CONSTRAINT "sales_order_note_length" CHECK("note" is null or length("note") between 1 and 1000),
	CONSTRAINT "sales_order_version_positive" CHECK("version" >= 1),
	CONSTRAINT "sales_order_updated_after_created" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "sales_order_deletion_whole" CHECK(("deleted_at" is null) = ("deleted_by" is null))
) STRICT;
--> statement-breakpoint
CREATE TABLE `product` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`search_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer NOT NULL,
	`archived_at` integer,
	`archived_by` text,
	CONSTRAINT `fk_product_created_by_account_id_fk` FOREIGN KEY (`created_by`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_product_updated_by_account_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_product_archived_by_account_id_fk` FOREIGN KEY (`archived_by`) REFERENCES `account`(`id`),
	CONSTRAINT "product_name_present" CHECK(length(trim("name")) between 1 and 100),
	CONSTRAINT "product_version_positive" CHECK("version" >= 1),
	CONSTRAINT "product_updated_after_created" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "product_archival_whole" CHECK(("archived_at" is null) = ("archived_by" is null))
) STRICT;
--> statement-breakpoint
CREATE INDEX `order_change_by_order` ON `order_change` (`order_id`,`changed_at`);--> statement-breakpoint
CREATE INDEX `order_line_by_product` ON `order_line` (`product_id`);--> statement-breakpoint
CREATE INDEX `payment_by_order` ON `payment` (`order_id`);--> statement-breakpoint
CREATE INDEX `sales_order_live_by_day` ON `sales_order` (`ordered_on`) WHERE "sales_order"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `sales_order_by_customer` ON `sales_order` (`customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_active_name` ON `product` (`search_name`) WHERE "product"."archived_at" is null;
--> statement-breakpoint
CREATE TRIGGER `sales_order_version_moves_by_one` BEFORE UPDATE ON `sales_order`
WHEN NEW.`version` IS NOT OLD.`version` + 1
BEGIN
	SELECT RAISE(ABORT, 'stale_version');
END;
--> statement-breakpoint
CREATE TRIGGER `sales_order_creation_is_fixed` BEFORE UPDATE ON `sales_order`
WHEN NEW.`created_at` IS NOT OLD.`created_at` OR NEW.`created_by` IS NOT OLD.`created_by`
BEGIN
	SELECT RAISE(ABORT, 'creation_is_fixed');
END;
--> statement-breakpoint
CREATE TRIGGER `product_version_moves_by_one` BEFORE UPDATE ON `product`
WHEN NEW.`version` IS NOT OLD.`version` + 1
BEGIN
	SELECT RAISE(ABORT, 'stale_version');
END;
--> statement-breakpoint
CREATE TRIGGER `product_creation_is_fixed` BEFORE UPDATE ON `product`
WHEN NEW.`created_at` IS NOT OLD.`created_at` OR NEW.`created_by` IS NOT OLD.`created_by`
BEGIN
	SELECT RAISE(ABORT, 'creation_is_fixed');
END;
--> statement-breakpoint
CREATE TRIGGER `order_change_no_update` BEFORE UPDATE ON `order_change`
BEGIN
	SELECT RAISE(ABORT, 'order_change is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `order_change_no_delete` BEFORE DELETE ON `order_change`
BEGIN
	SELECT RAISE(ABORT, 'order_change is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `payment_only_removal` BEFORE UPDATE ON `payment`
WHEN NEW.`id` IS NOT OLD.`id` OR NEW.`order_id` IS NOT OLD.`order_id` OR NEW.`amount` IS NOT OLD.`amount`
	OR NEW.`paid_on` IS NOT OLD.`paid_on` OR NEW.`method` IS NOT OLD.`method` OR NEW.`note` IS NOT OLD.`note`
	OR NEW.`recorded_at` IS NOT OLD.`recorded_at` OR NEW.`recorded_by` IS NOT OLD.`recorded_by`
	OR OLD.`deleted_at` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'a payment is only ever removed');
END;
--> statement-breakpoint
CREATE TRIGGER `payment_no_delete` BEFORE DELETE ON `payment`
BEGIN
	SELECT RAISE(ABORT, 'a payment is only ever removed');
END;