import { sql } from "drizzle-orm";
import { index, text, sqliteTable } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  source: text("source").notNull().default("manual"),
  sourceUrl: text("source_url").notNull().unique(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  companyLogoUrl: text("company_logo_url").notNull().default(""),
  salaryText: text("salary_text").notNull().default("薪资面议"),
  locationText: text("location_text").notNull().default("地点待补充"),
  experienceText: text("experience_text").notNull().default("经验不限"),
  educationText: text("education_text").notNull().default("学历不限"),
  jobDescription: text("job_description").notNull().default(""),
  skillTags: text("skill_tags").notNull().default("[]"),
  status: text("status").notNull().default("未投递"),
  savedAt: text("saved_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_jobs_saved_at").on(table.savedAt)]);
