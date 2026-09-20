export const AI_API_KEY_STORAGE = "job-workbench.deepseek-api-key";
export const QWEN_API_KEY_STORAGE = "job-workbench.qwen-api-key";
export const AI_PROFILE_STORAGE = "job-workbench.ai-profile";
export const GENERATED_RESUME_STORAGE = "job-workbench.generated-resume";

export type AiProfile = {
  summary: string;
  targetRoles: string[];
  personalInfo?: Record<string, string>;
  archives: Array<{
    type: "工作经历" | "项目经历" | "教育经历" | "成果证明";
    title: string;
    subtitle: string;
    date: string;
    description: string;
    skills: string[];
    facts: string[];
    confirmedFacts?: string[];
    evidence: string[];
  }>;
};

export type JobAnalysis = {
  summary: string;
  responsibilities: string[];
  requirements: string[];
  hardRisks: Array<{
    type: "certificate" | "age" | "experience" | "degree" | "major" | "student_status" | "language" | "availability" | "other";
    severity?: "hard" | "preference";
    status?: "unmet" | "uncertain";
    label: string;
    requirement?: string;
    reason: string;
  }>;
  matched: Array<{ skill: string; requirement?: string; evidence: string }>;
  gaps: Array<{ skill: string; requirement?: string; reason: string; status?: "missing" | "uncertain"; importance: string }>;
  caveats: string[];
};

export type InterviewQuestionCategory = "通用与动机" | "岗位专业" | "简历深挖" | "行为与场景" | "硬性风险";

export type InterviewQuestion = {
  id: string;
  category: InterviewQuestionCategory;
  question: string;
  source: string;
  intent: string;
  answerFramework: Array<{ title: string; guidance: string }>;
  suggestedAnswer?: string;
  evidenceSuggestions: Array<{ title: string; detail: string }>;
  followUps: string[];
};

export type InterviewPack = {
  job: { id: string; title: string; company: string };
  questions: InterviewQuestion[];
  createdAt: string;
};

export type ResumeDesign = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  pageMargin: number;
  accentColor: string;
  /** Official habaneraa spacing multiplier. Other templates ignore it. */
  elementSpaciness?: number;
};

export type GeneratedResume = {
  title: string;
  targetRole: string;
  headline: string;
  summary: string;
  skills: string[];
  experiences: Array<{
    type: string;
    title: string;
    subtitle: string;
    date: string;
    bullets: string[];
  }>;
  job: { id: string; title: string; company: string };
  personalInfo: Record<string, string>;
  match: number;
  createdAt: string;
  /** Last successful local autosave. Older drafts may not have this field. */
  updatedAt?: string;
  template?: "habaneraa-one-page-resume-zh" | "golixp-resume-zh-cn" | "bone-resume" | "brilliant-cv" | "modern-cv" | "basic-resume" | "altacv" | "vivid-cv";
  design?: ResumeDesign;
  methodologyId?: string;
  methodologyName?: string;
  /** Literal lines explicitly requested by the user for a visual layout test. */
  layoutAppendText?: string[];
  // The editable, compiled Typst document. It is kept beside the structured
  // source facts so AI changes are made against the actual template source.
  typstSource?: string;
};

export function getAiApiKey() {
  if (typeof window === "undefined") return "";
  const persisted = window.localStorage.getItem(AI_API_KEY_STORAGE);
  if (persisted) return persisted;
  const legacy = window.sessionStorage.getItem(AI_API_KEY_STORAGE) ?? "";
  if (legacy) window.localStorage.setItem(AI_API_KEY_STORAGE, legacy);
  return legacy;
}

export function saveAiApiKey(value: string) {
  window.localStorage.setItem(AI_API_KEY_STORAGE, value.trim());
  window.sessionStorage.removeItem(AI_API_KEY_STORAGE);
  window.dispatchEvent(new Event("job-workbench:ai-context-updated"));
}

export function clearAiApiKey() {
  window.localStorage.removeItem(AI_API_KEY_STORAGE);
  window.sessionStorage.removeItem(AI_API_KEY_STORAGE);
  window.dispatchEvent(new Event("job-workbench:ai-context-updated"));
}

export function getQwenApiKey() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(QWEN_API_KEY_STORAGE) ?? "";
}

export function saveQwenApiKey(value: string) {
  window.localStorage.setItem(QWEN_API_KEY_STORAGE, value.trim());
  window.dispatchEvent(new Event("job-workbench:ai-context-updated"));
}

export function clearQwenApiKey() {
  window.localStorage.removeItem(QWEN_API_KEY_STORAGE);
  window.dispatchEvent(new Event("job-workbench:ai-context-updated"));
}

export function getAiProfile(): AiProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(AI_PROFILE_STORAGE);
    return value ? JSON.parse(value) as AiProfile : null;
  } catch {
    return null;
  }
}

export function saveAiProfile(profile: AiProfile) {
  window.localStorage.setItem(AI_PROFILE_STORAGE, JSON.stringify(profile));
  if (profile.personalInfo && Object.values(profile.personalInfo).some(Boolean)) {
    const visible = ["name", "phone", "email", "city", "experience", "targetRole", ...Object.keys(profile.personalInfo)];
    const detail = { values: profile.personalInfo, visible: [...new Set(visible)] };
    window.localStorage.setItem("job-workbench.personal-info", JSON.stringify(detail));
    window.dispatchEvent(new CustomEvent("job-workbench:personal-info-updated", { detail }));
  }
  window.dispatchEvent(new Event("job-workbench:ai-context-updated"));
}

export async function callAi<T>(path: string, body: unknown): Promise<T> {
  const apiKey = getAiApiKey();
  if (!apiKey) throw new Error("请先在设置中接入 DeepSeek API Key");
  return requestAi<T>(path, body, { "X-DeepSeek-API-Key": apiKey }, 90_000, "文字 AI");
}

export async function callVisionAi<T>(path: string, body: unknown): Promise<T> {
  const apiKey = getQwenApiKey();
  if (!apiKey) throw new Error("请先在设置中接入阿里云百炼 API Key（Qwen3-VL-Flash）");
  return requestAi<T>(path, body, { "X-DashScope-API-Key": apiKey }, 180_000, "视觉 AI");
}

async function requestAi<T>(path: string, body: unknown, headers: Record<string, string>, timeoutMs: number, label: string) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({ error: `${label} 返回了无法解析的响应` })) as T & { error?: string };
    if (!response.ok) throw new Error(data.error || `${label} 请求失败，请稍后重试`);
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error(`${label} 请求超时，请稍后重试`);
    throw error;
  } finally { window.clearTimeout(timer); }
}
