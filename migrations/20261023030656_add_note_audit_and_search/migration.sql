-- Written by hand: drizzle-kit emitted ALTER TABLE ... NOT NULL, which SQLite refuses without a default. The table is
-- rebuilt STRICT with the audit columns of ADR 0011, each note's author taken from its capture, and two triggers that
-- keep versions honest. search_text starts as lower(content), which folds ASCII only; it is rewritten on the next
-- edit. schema.test.ts fails if STRICT, a check or a trigger goes missing.
CREATE TABLE `__new_note` (
	`id` text PRIMARY KEY,
	`capture_id` text NOT NULL,
	`content` text NOT NULL,
	`search_text` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by` text,
	CONSTRAINT `fk_note_capture_id_capture_id_fk` FOREIGN KEY (`capture_id`) REFERENCES `capture`(`id`),
	CONSTRAINT `fk_note_created_by_account_id_fk` FOREIGN KEY (`created_by`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_note_updated_by_account_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `account`(`id`),
	CONSTRAINT `fk_note_deleted_by_account_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `account`(`id`),
	CONSTRAINT "note_content_present" CHECK(length(trim("content")) > 0),
	CONSTRAINT "note_version_positive" CHECK("version" >= 1),
	CONSTRAINT "note_updated_after_created" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "note_deletion_whole" CHECK(("deleted_at" is null) = ("deleted_by" is null))
) STRICT;
--> statement-breakpoint
INSERT INTO `__new_note`(`id`, `capture_id`, `content`, `search_text`, `created_at`, `created_by`, `updated_at`, `updated_by`, `version`, `deleted_at`, `deleted_by`)
SELECT `note`.`id`, `note`.`capture_id`, `note`.`content`, lower(`note`.`content`), `note`.`created_at`, `capture`.`author_id`, `note`.`updated_at`, `capture`.`author_id`, 1, `note`.`deleted_at`, CASE WHEN `note`.`deleted_at` IS NULL THEN NULL ELSE `capture`.`author_id` END
FROM `note` JOIN `capture` ON `capture`.`id` = `note`.`capture_id`;
--> statement-breakpoint
DROP TABLE `note`;
--> statement-breakpoint
ALTER TABLE `__new_note` RENAME TO `note`;
--> statement-breakpoint
CREATE INDEX `note_live_by_created_at` ON `note` (`created_at`) WHERE "note"."deleted_at" is null;
--> statement-breakpoint
CREATE INDEX `note_by_capture` ON `note` (`capture_id`);
--> statement-breakpoint
CREATE TRIGGER `note_version_moves_by_one` BEFORE UPDATE ON `note`
WHEN NEW.`version` IS NOT OLD.`version` + 1
BEGIN
	SELECT RAISE(ABORT, 'stale_version');
END;
--> statement-breakpoint
CREATE TRIGGER `note_creation_is_fixed` BEFORE UPDATE ON `note`
WHEN NEW.`created_at` IS NOT OLD.`created_at` OR NEW.`created_by` IS NOT OLD.`created_by`
BEGIN
	SELECT RAISE(ABORT, 'creation_is_fixed');
END;
