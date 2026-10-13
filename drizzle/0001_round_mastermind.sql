CREATE TABLE IF NOT EXISTS `integration_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `integration_keys_token_hash_unique` ON `integration_keys` (`token_hash`);
