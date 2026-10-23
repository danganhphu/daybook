-- Edited by hand: STRICT, and the two audit triggers on each table (ADR 0011, decision 9). schema.test.ts fails if
-- any goes missing.
CREATE TABLE `customer_kind` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`search_name` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer NOT NULL,
	`archived_at` integer,
	`archived_by` text,
	CONSTRAINT `fk_customer_kind_created_by_account_id_fk` FOREIGN KEY (`created_by`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_customer_kind_updated_by_account_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_customer_kind_archived_by_account_id_fk` FOREIGN KEY (`archived_by`) REFERENCES `account`(`id`),
	CONSTRAINT "customer_kind_name_present" CHECK(length(trim("name")) between 1 and 40),
	CONSTRAINT "customer_kind_position_positive" CHECK("position" >= 0),
	CONSTRAINT "customer_kind_version_positive" CHECK("version" >= 1),
	CONSTRAINT "customer_kind_updated_after_created" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "customer_kind_archival_whole" CHECK(("archived_at" is null) = ("archived_by" is null))
) STRICT;
--> statement-breakpoint
CREATE TABLE `customer` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`search_name` text NOT NULL,
	`kind_id` text,
	`area` text,
	`phone` text,
	`address` text,
	`note` text,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer NOT NULL,
	`archived_at` integer,
	`archived_by` text,
	CONSTRAINT `fk_customer_kind_id_customer_kind_id_fk` FOREIGN KEY (`kind_id`) REFERENCES `customer_kind`(`id`),
	CONSTRAINT `fk_customer_created_by_account_id_fk` FOREIGN KEY (`created_by`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_customer_updated_by_account_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_customer_archived_by_account_id_fk` FOREIGN KEY (`archived_by`) REFERENCES `account`(`id`),
	CONSTRAINT "customer_name_present" CHECK(length(trim("name")) between 1 and 100),
	CONSTRAINT "customer_details_length" CHECK(("area" is null or length("area") between 1 and 60)
        and ("phone" is null or length("phone") between 1 and 20)
        and ("address" is null or length("address") between 1 and 200)
        and ("note" is null or length("note") between 1 and 1000)),
	CONSTRAINT "customer_version_positive" CHECK("version" >= 1),
	CONSTRAINT "customer_updated_after_created" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "customer_archival_whole" CHECK(("archived_at" is null) = ("archived_by" is null))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_kind_active_name` ON `customer_kind` (`search_name`) WHERE "customer_kind"."archived_at" is null;--> statement-breakpoint
CREATE INDEX `customer_kind_by_position` ON `customer_kind` (`position`);--> statement-breakpoint
CREATE INDEX `customer_active_by_name` ON `customer` (`search_name`) WHERE "customer"."archived_at" is null;--> statement-breakpoint
CREATE INDEX `customer_by_kind` ON `customer` (`kind_id`);
--> statement-breakpoint
CREATE TRIGGER `customer_kind_version_moves_by_one` BEFORE UPDATE ON `customer_kind`
WHEN NEW.`version` IS NOT OLD.`version` + 1
BEGIN
	SELECT RAISE(ABORT, 'stale_version');
END;
--> statement-breakpoint
CREATE TRIGGER `customer_kind_creation_is_fixed` BEFORE UPDATE ON `customer_kind`
WHEN NEW.`created_at` IS NOT OLD.`created_at` OR NEW.`created_by` IS NOT OLD.`created_by`
BEGIN
	SELECT RAISE(ABORT, 'creation_is_fixed');
END;
--> statement-breakpoint
CREATE TRIGGER `customer_version_moves_by_one` BEFORE UPDATE ON `customer`
WHEN NEW.`version` IS NOT OLD.`version` + 1
BEGIN
	SELECT RAISE(ABORT, 'stale_version');
END;
--> statement-breakpoint
CREATE TRIGGER `customer_creation_is_fixed` BEFORE UPDATE ON `customer`
WHEN NEW.`created_at` IS NOT OLD.`created_at` OR NEW.`created_by` IS NOT OLD.`created_by`
BEGIN
	SELECT RAISE(ABORT, 'creation_is_fixed');
END;