-- Edited by hand: STRICT, the two triggers that keep it append-only, as on capture (ADR 0012, decision 5), and one
-- that refuses a reading once the capture is settled, so two readings at once cannot make two orders.
-- interpretation-schema.test.ts fails if any goes missing.
CREATE TABLE `interpretation` (
	`id` text PRIMARY KEY,
	`capture_id` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` integer NOT NULL,
	`outcome` text NOT NULL,
	`result` text,
	`failure` text,
	`neurons` real,
	`read_at` integer NOT NULL,
	`read_by` text NOT NULL,
	CONSTRAINT `fk_interpretation_capture_id_capture_id_fk` FOREIGN KEY (`capture_id`) REFERENCES `capture`(`id`),
	CONSTRAINT `fk_interpretation_read_by_account_id_fk` FOREIGN KEY (`read_by`) REFERENCES `account`(`id`),
	CONSTRAINT "interpretation_outcome_known" CHECK("outcome" in ('order', 'reminder', 'note', 'unsure', 'failed')),
	CONSTRAINT "interpretation_failure_known" CHECK("failure" is null or "failure" in ('schema', 'quota', 'timeout', 'error', 'refused')),
	CONSTRAINT "interpretation_result_or_failure" CHECK((("outcome" = 'failed') = ("failure" is not null))
        and (("outcome" = 'failed') = ("result" is null))
        and ("result" is null or json_valid("result"))),
	CONSTRAINT "interpretation_model_present" CHECK(length("model") between 1 and 100),
	CONSTRAINT "interpretation_counts" CHECK("prompt_version" >= 0 and ("neurons" is null or "neurons" >= 0))
) STRICT;
--> statement-breakpoint
CREATE INDEX `interpretation_by_capture` ON `interpretation` (`capture_id`,`id`);
--> statement-breakpoint
CREATE TRIGGER `interpretation_no_update` BEFORE UPDATE ON `interpretation`
BEGIN
	SELECT RAISE(ABORT, 'interpretation is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `interpretation_no_delete` BEFORE DELETE ON `interpretation`
BEGIN
	SELECT RAISE(ABORT, 'interpretation is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `interpretation_once_settled` BEFORE INSERT ON `interpretation`
WHEN (SELECT `outcome` FROM `interpretation` WHERE `capture_id` = NEW.`capture_id` ORDER BY `id` DESC LIMIT 1)
	IN ('order', 'reminder', 'note')
BEGIN
	SELECT RAISE(ABORT, 'stale_version');
END;
