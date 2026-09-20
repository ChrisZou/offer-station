CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_url` text NOT NULL,
	`title` text NOT NULL,
	`company` text NOT NULL,
	`salary_text` text DEFAULT '薪资面议' NOT NULL,
	`location_text` text DEFAULT '地点待补充' NOT NULL,
	`experience_text` text DEFAULT '经验不限' NOT NULL,
	`education_text` text DEFAULT '学历不限' NOT NULL,
	`job_description` text DEFAULT '' NOT NULL,
	`skill_tags` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT '待判断' NOT NULL,
	`saved_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_source_url_unique` ON `jobs` (`source_url`);