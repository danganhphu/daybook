-- Edited by hand: STRICT on every new table and on the rebuilt order_change; drizzle-kit's PRAGMA foreign_keys pair
-- removed, since no table points at order_change; order_change's append-only triggers re-created (the rebuild drops
-- them); the merge records append-only too; and on customer and product, a trigger that lets a row name what it was
-- merged into only while hidden, and never itself (a CHECK would rebuild both tables). schema.test.ts and
-- merge-schema.test.ts fail if any goes missing.
CREATE TABLE `customer_alias` (
	`id` text PRIMARY KEY,
	`customer_id` text NOT NULL,
	`name` text NOT NULL,
	`search_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	CONSTRAINT `fk_customer_alias_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`),
	CONSTRAINT `fk_customer_alias_created_by_account_id_fk` FOREIGN KEY (`created_by`) REFERENCES `account`(`id`),
	CONSTRAINT "customer_alias_name_present" CHECK(length(trim("name")) between 1 and 100)
) STRICT;
--> statement-breakpoint
CREATE TABLE `customer_merge` (
	`id` text PRIMARY KEY,
	`from_id` text NOT NULL,
	`into_id` text NOT NULL,
	`moved` text NOT NULL,
	`merged_at` integer NOT NULL,
	`merged_by` text NOT NULL,
	CONSTRAINT `fk_customer_merge_from_id_customer_id_fk` FOREIGN KEY (`from_id`) REFERENCES `customer`(`id`),
	CONSTRAINT `fk_customer_merge_into_id_customer_id_fk` FOREIGN KEY (`into_id`) REFERENCES `customer`(`id`),
	CONSTRAINT `fk_customer_merge_merged_by_account_id_fk` FOREIGN KEY (`merged_by`) REFERENCES `account`(`id`),
	CONSTRAINT "customer_merge_not_itself" CHECK("from_id" <> "into_id"),
	CONSTRAINT "customer_merge_moved_json" CHECK(json_valid("moved"))
) STRICT;
--> statement-breakpoint
CREATE TABLE `product_merge` (
	`id` text PRIMARY KEY,
	`from_id` text NOT NULL,
	`into_id` text NOT NULL,
	`moved` text NOT NULL,
	`merged_at` integer NOT NULL,
	`merged_by` text NOT NULL,
	CONSTRAINT `fk_product_merge_from_id_product_id_fk` FOREIGN KEY (`from_id`) REFERENCES `product`(`id`),
	CONSTRAINT `fk_product_merge_into_id_product_id_fk` FOREIGN KEY (`into_id`) REFERENCES `product`(`id`),
	CONSTRAINT `fk_product_merge_merged_by_account_id_fk` FOREIGN KEY (`merged_by`) REFERENCES `account`(`id`),
	CONSTRAINT "product_merge_not_itself" CHECK("from_id" <> "into_id"),
	CONSTRAINT "product_merge_moved_json" CHECK(json_valid("moved"))
) STRICT;
--> statement-breakpoint
CREATE TABLE `product_alias` (
	`id` text PRIMARY KEY,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`search_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	CONSTRAINT `fk_product_alias_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`),
	CONSTRAINT `fk_product_alias_created_by_account_id_fk` FOREIGN KEY (`created_by`) REFERENCES `account`(`id`),
	CONSTRAINT "product_alias_name_present" CHECK(length(trim("name")) between 1 and 100)
) STRICT;
--> statement-breakpoint
ALTER TABLE `customer` ADD `merged_into_id` text REFERENCES customer(id);--> statement-breakpoint
ALTER TABLE `product` ADD `merged_into_id` text REFERENCES product(id);--> statement-breakpoint
CREATE TABLE `__new_order_change` (
	`id` text PRIMARY KEY,
	`order_id` text NOT NULL,
	`kind` text NOT NULL,
	`changed_at` integer NOT NULL,
	`changed_by` text NOT NULL,
	`before` text,
	`after` text NOT NULL,
	CONSTRAINT `fk_order_change_order_id_sales_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `sales_order`(`id`),
	CONSTRAINT `fk_order_change_changed_by_account_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `account`(`id`),
	CONSTRAINT "order_change_kind_known" CHECK("kind" in ('placed', 'revised', 'delivered', 'undelivered', 'payment_added', 'payment_removed', 'deleted', 'restored', 'customer_merged', 'product_merged')),
	CONSTRAINT "order_change_json" CHECK(json_valid("after") and ("before" is null or json_valid("before")))
) STRICT;
--> statement-breakpoint
INSERT INTO `__new_order_change`(`id`, `order_id`, `kind`, `changed_at`, `changed_by`, `before`, `after`) SELECT `id`, `order_id`, `kind`, `changed_at`, `changed_by`, `before`, `after` FROM `order_change`;--> statement-breakpoint
DROP TABLE `order_change`;--> statement-breakpoint
ALTER TABLE `__new_order_change` RENAME TO `order_change`;--> statement-breakpoint
CREATE INDEX `order_change_by_order` ON `order_change` (`order_id`,`changed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_alias_per_customer` ON `customer_alias` (`customer_id`,`search_name`);--> statement-breakpoint
CREATE INDEX `customer_alias_by_name` ON `customer_alias` (`search_name`);--> statement-breakpoint
CREATE INDEX `customer_merge_by_into` ON `customer_merge` (`into_id`);--> statement-breakpoint
CREATE INDEX `product_merge_by_into` ON `product_merge` (`into_id`);--> statement-breakpoint
CREATE INDEX `note_deleted_by_deleted_at` ON `note` (`deleted_at`) WHERE "note"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX `sales_order_deleted_by_deleted_at` ON `sales_order` (`deleted_at`) WHERE "sales_order"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `product_alias_by_name` ON `product_alias` (`search_name`);--> statement-breakpoint
CREATE INDEX `product_alias_by_product` ON `product_alias` (`product_id`);--> statement-breakpoint
CREATE INDEX `reminder_done_by_done_at` ON `reminder` (`done_at`,`id`) WHERE "reminder"."done_at" is not null and "reminder"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `reminder_deleted_by_deleted_at` ON `reminder` (`deleted_at`) WHERE "reminder"."deleted_at" is not null;
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
CREATE TRIGGER `customer_merge_no_update` BEFORE UPDATE ON `customer_merge`
BEGIN
	SELECT RAISE(ABORT, 'customer_merge is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `customer_merge_no_delete` BEFORE DELETE ON `customer_merge`
BEGIN
	SELECT RAISE(ABORT, 'customer_merge is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `product_merge_no_update` BEFORE UPDATE ON `product_merge`
BEGIN
	SELECT RAISE(ABORT, 'product_merge is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `product_merge_no_delete` BEFORE DELETE ON `product_merge`
BEGIN
	SELECT RAISE(ABORT, 'product_merge is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `customer_merged_only_hidden_on_insert` BEFORE INSERT ON `customer`
WHEN NEW.`merged_into_id` IS NOT NULL AND (NEW.`archived_at` IS NULL OR NEW.`merged_into_id` = NEW.`id`)
BEGIN
	SELECT RAISE(ABORT, 'merged_only_hidden');
END;
--> statement-breakpoint
CREATE TRIGGER `customer_merged_only_hidden_on_update` BEFORE UPDATE ON `customer`
WHEN NEW.`merged_into_id` IS NOT NULL AND (NEW.`archived_at` IS NULL OR NEW.`merged_into_id` = NEW.`id`)
BEGIN
	SELECT RAISE(ABORT, 'merged_only_hidden');
END;
--> statement-breakpoint
CREATE TRIGGER `product_merged_only_hidden_on_insert` BEFORE INSERT ON `product`
WHEN NEW.`merged_into_id` IS NOT NULL AND (NEW.`archived_at` IS NULL OR NEW.`merged_into_id` = NEW.`id`)
BEGIN
	SELECT RAISE(ABORT, 'merged_only_hidden');
END;
--> statement-breakpoint
CREATE TRIGGER `product_merged_only_hidden_on_update` BEFORE UPDATE ON `product`
WHEN NEW.`merged_into_id` IS NOT NULL AND (NEW.`archived_at` IS NULL OR NEW.`merged_into_id` = NEW.`id`)
BEGIN
	SELECT RAISE(ABORT, 'merged_only_hidden');
END;