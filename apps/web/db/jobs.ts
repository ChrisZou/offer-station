import { env } from "cloudflare:workers";

export interface SavedJob {
  id: string;
  source: string;
  sourceUrl: string;
  title: string;
  company: string;
  companyLogoUrl: string;
  salaryText: string;
  locationText: string;
  experienceText: string;
  educationText: string;
  jobDescription: string;
  skillTags: string[];
  status: string;
  savedAt: string;
  updatedAt: string;
}

export interface SavedJobInput {
  source?: string;
  sourceUrl?: string;
  title: string;
  company: string;
  companyLogoUrl?: string;
  salaryText?: string;
  locationText?: string;
  experienceText?: string;
  educationText?: string;
  jobDescription?: string;
  skillTags?: string[];
}

type JobRow = Omit<SavedJob, "skillTags"> & { skillTags: string };

async function getDatabase() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");

  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      source_url TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      company_logo_url TEXT NOT NULL DEFAULT '',
      salary_text TEXT NOT NULL DEFAULT '薪资面议',
      location_text TEXT NOT NULL DEFAULT '地点待补充',
      experience_text TEXT NOT NULL DEFAULT '经验不限',
      education_text TEXT NOT NULL DEFAULT '学历不限',
      job_description TEXT NOT NULL DEFAULT '',
      skill_tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT '未投递',
      saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_url ON jobs(source_url)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_jobs_saved_at ON jobs(saved_at DESC)"),
  ]);

  const columns = await env.DB.prepare("PRAGMA table_info(jobs)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "company_logo_url")) {
    await env.DB.prepare("ALTER TABLE jobs ADD COLUMN company_logo_url TEXT NOT NULL DEFAULT ''").run();
  }

  await env.DB.prepare("UPDATE jobs SET status = '未投递' WHERE status IN ('待判断', '待投递', '')").run();

  return env.DB;
}

function normalizeRow(row: Record<string, unknown>): SavedJob {
  const raw = row as unknown as JobRow;
  let skillTags: string[] = [];
  try { skillTags = JSON.parse(raw.skillTags || "[]") as string[]; } catch { skillTags = []; }
  return { ...raw, skillTags };
}

export async function listJobs(limit = 100): Promise<SavedJob[]> {
  const db = await getDatabase();
  const result = await db.prepare(`SELECT
      id, source, source_url AS sourceUrl, title, company,
      company_logo_url AS companyLogoUrl,
      salary_text AS salaryText, location_text AS locationText,
      experience_text AS experienceText, education_text AS educationText,
      job_description AS jobDescription, skill_tags AS skillTags,
      status, saved_at AS savedAt, updated_at AS updatedAt
    FROM jobs ORDER BY datetime(saved_at) DESC LIMIT ?`).bind(limit).all();
  return result.results.map(normalizeRow);
}

export async function saveJob(input: SavedJobInput): Promise<{ job: SavedJob; created: boolean }> {
  const db = await getDatabase();
  const id = crypto.randomUUID();
  const sourceUrl = input.sourceUrl?.trim() || `manual:${id}`;
  const existing = await db.prepare("SELECT id FROM jobs WHERE source_url = ? LIMIT 1").bind(sourceUrl).first<{ id: string }>();

  await db.prepare(`INSERT INTO jobs (
      id, source, source_url, title, company, company_logo_url, salary_text, location_text,
      experience_text, education_text, job_description, skill_tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_url) DO UPDATE SET
      title = excluded.title,
      company = excluded.company,
      company_logo_url = excluded.company_logo_url,
      salary_text = excluded.salary_text,
      location_text = excluded.location_text,
      experience_text = excluded.experience_text,
      education_text = excluded.education_text,
      job_description = excluded.job_description,
      skill_tags = excluded.skill_tags,
      updated_at = CURRENT_TIMESTAMP`).bind(
        id,
        input.source?.trim() || "manual",
        sourceUrl,
        input.title.trim(),
        input.company.trim(),
        input.companyLogoUrl?.trim() || "",
        input.salaryText?.trim() || "薪资面议",
        input.locationText?.trim() || "地点待补充",
        input.experienceText?.trim() || "经验不限",
        input.educationText?.trim() || "学历不限",
        input.jobDescription?.trim() || "",
        JSON.stringify(input.skillTags ?? []),
      ).run();

  const row = await db.prepare(`SELECT
      id, source, source_url AS sourceUrl, title, company,
      company_logo_url AS companyLogoUrl,
      salary_text AS salaryText, location_text AS locationText,
      experience_text AS experienceText, education_text AS educationText,
      job_description AS jobDescription, skill_tags AS skillTags,
      status, saved_at AS savedAt, updated_at AS updatedAt
    FROM jobs WHERE source_url = ? LIMIT 1`).bind(sourceUrl).first();
  if (!row) throw new Error("岗位保存后未能读取");
  return { job: normalizeRow(row), created: !existing };
}

export async function removeJob(id: string) {
  const db = await getDatabase();
  await db.prepare("DELETE FROM jobs WHERE id = ?").bind(id).run();
}

export const jobStatuses = ["未投递", "已投递", "已读", "面试中", "已结束"] as const;

export async function updateJobStatus(id: string, status: string): Promise<SavedJob> {
  if (!jobStatuses.includes(status as (typeof jobStatuses)[number])) throw new Error("不支持的求职状态");
  const db = await getDatabase();
  await db.prepare("UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, id).run();
  const row = await db.prepare(`SELECT
      id, source, source_url AS sourceUrl, title, company,
      company_logo_url AS companyLogoUrl,
      salary_text AS salaryText, location_text AS locationText,
      experience_text AS experienceText, education_text AS educationText,
      job_description AS jobDescription, skill_tags AS skillTags,
      status, saved_at AS savedAt, updated_at AS updatedAt
    FROM jobs WHERE id = ? LIMIT 1`).bind(id).first();
  if (!row) throw new Error("岗位不存在");
  return normalizeRow(row);
}

export async function removeAllJobs() {
  const db = await getDatabase();
  await db.prepare("DELETE FROM jobs").run();
}
