-- Edited by hand: STRICT, and the two audit triggers (ADR 0011, decision 9). audited-tables.test.ts fails if either
-- goes missing.
CREATE TABLE `reminder` (
	`id` text PRIMARY KEY,
	`capture_id` text,
	`text` text NOT NULL,
	`due_on` text NOT NULL,
	`customer_id` text,
	`done_at` integer,
	`done_by` text,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by` text,
	CONSTRAINT `fk_reminder_capture_id_capture_id_fk` FOREIGN KEY (`capture_id`) REFERENCES `capture`(`id`),
	CONSTRAINT `fk_reminder_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`),
	CONSTRAINT `fk_reminder_done_by_account_id_fk` FOREIGN KEY (`done_by`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_reminder_created_by_account_id_fk` FOREIGN KEY (`created_by`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_reminder_updated_by_account_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_reminder_deleted_by_account_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `account`(`id`),
	CONSTRAINT "reminder_text_present" CHECK(length(trim("text")) > 0 and length("text") <= 4000),
	CONSTRAINT "reminder_due_on_day" CHECK("due_on" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "reminder_completion_whole" CHECK(("done_at" is null) = ("done_by" is null)),
	CONSTRAINT "reminder_version_positive" CHECK("version" >= 1),
	CONSTRAINT "reminder_updated_after_created" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "reminder_deletion_whole" CHECK(("deleted_at" is null) = ("deleted_by" is null))
) STRICT;
--> statement-breakpoint
CREATE INDEX `reminder_open_by_due_on` ON `reminder` (`due_on`) WHERE "reminder"."done_at" is null and "reminder"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `reminder_by_customer` ON `reminder` (`customer_id`);
--> statement-breakpoint
CREATE TRIGGER `reminder_version_moves_by_one` BEFORE UPDATE ON `reminder`
WHEN NEW.`version` IS NOT OLD.`version` + 1
BEGIN
	SELECT RAISE(ABORT, 'stale_version');
END;
--> statement-breakpoint
CREATE TRIGGER `reminder_creation_is_fixed` BEFORE UPDATE ON `reminder`
WHEN NEW.`created_at` IS NOT OLD.`created_at` OR NEW.`created_by` IS NOT OLD.`created_by`
BEGIN
	SELECT RAISE(ABORT, 'creation_is_fixed');
END;
