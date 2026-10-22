-- Written by hand: drizzle-kit emitted an ALTER TABLE that SQLite refuses for a NOT NULL foreign key, so the table is
-- rebuilt, with STRICT and the append-only triggers re-created. Captures made before sign-in have no author; nothing
-- is deployed, so they exist only on development databases and are dropped with their notes rather than given an
-- author they never had. schema.test.ts fails if STRICT or a trigger goes missing.
DELETE FROM `note`;
--> statement-breakpoint
DROP TABLE `capture`;
--> statement-breakpoint
CREATE TABLE `capture` (
	`id` text PRIMARY KEY,
	`content` text NOT NULL,
	`source` text NOT NULL,
	`author_id` text NOT NULL,
	`received_at` integer NOT NULL,
	CONSTRAINT `fk_capture_author_id_account_id_fk` FOREIGN KEY (`author_id`) REFERENCES `account`(`id`),
	CONSTRAINT "capture_source_known" CHECK("source" in ('web', 'telegram')),
	CONSTRAINT "capture_content_present" CHECK(length(trim("content")) > 0)
) STRICT;
--> statement-breakpoint
CREATE TRIGGER `capture_no_update` BEFORE UPDATE ON `capture`
BEGIN
	SELECT RAISE(ABORT, 'capture is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `capture_no_delete` BEFORE DELETE ON `capture`
BEGIN
	SELECT RAISE(ABORT, 'capture is append-only');
END;
