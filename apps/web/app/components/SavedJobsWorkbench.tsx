"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  IoAddOutline,
  IoAlertCircleOutline,
  IoBusinessOutline,
  IoChatbubbleEllipsesOutline,
  IoCheckmarkCircleOutline,
  IoChevronDownOutline,
  IoCloseOutline,
  IoCopyOutline,
  IoDocumentTextOutline,
  IoFilterOutline,
  IoChatbubblesOutline,
  IoLocationOutline,
  IoRefreshOutline,
  IoSparklesOutline,
  IoStarOutline,
} from "react-icons/io5";
import { AppSidebar, AppTopbar, SyncStatus } from "./AppChrome";
import { CompanyLogo } from "./CompanyLogo";
import { callAi, getAiProfile, type JobAnalysis } from "../lib/ai-client";
import { isDemoMode, loadDemoJobs } from "../lib/demo-data";

type DisplayJobAnalysis = Omit<JobAnalysis, "matched" | "gaps"> & {
  matched: string[];
  gaps: string[];
};

type CachedJobAnalysis = {
  signature: string;
  result: DisplayJobAnalysis;
  savedAt: string;
};

const analysisCacheKey = "job-workbench.saved-job-analyses.v1";
const greetingCacheKey = "job-workbench.job-greetings.v3";
const greetingAudienceOptions = [
  { label: "招聘 HR", description: "先给出能通过初筛的条件与亮点信号" },
  { label: "业务负责人", description: "先给出技术适配与可验证成果" },
  { label: "公司负责人", description: "先给出对公司机会的理解与核心价值" },
] as const;
type GreetingAudience = (typeof greetingAudienceOptions)[number]["label"];
type GreetingJudgment = {
  strategy: string;
  highlight: string;
  reason: string;
  confidence: "明确亮点" | "可用亮点" | "暂无强亮点";
};
type CachedGreeting = { greeting: string; judgment?: GreetingJudgment };
const jobStatusOptions = ["未投递", "已投递", "已读", "面试中", "Offer", "已结束"] as const;

function greetingCacheId(jobId: string, audience: GreetingAudience) {
  return `${jobId}:${audience}`;
}

function readCachedGreeting(jobId: string, audience: GreetingAudience): CachedGreeting | null {
  try {
    const greetings = JSON.parse(window.localStorage.getItem(greetingCacheKey) || "{}") as Record<string, CachedGreeting>;
    const entry = greetings[greetingCacheId(jobId, audience)];
    return entry && typeof entry.greeting === "string" ? entry : null;
  } catch {
    return null;
  }
}

function saveCachedGreeting(jobId: string, audience: GreetingAudience, entry: CachedGreeting) {
  let greetings: Record<string, CachedGreeting> = {};
  try {
    greetings = JSON.parse(window.localStorage.getItem(greetingCacheKey) || "{}") as Record<string, CachedGreeting>;
  } catch { /* 缓存损坏时用当前草稿重新建立 */ }
  greetings[greetingCacheId(jobId, audience)] = entry;
  window.localStorage.setItem(greetingCacheKey, JSON.stringify(greetings));
}

function normalizedStatus(status: string) {
  return status === "待判断" || status === "待投递" || !status ? "未投递" : status;
}

function sourceName(source: string, compact = false) {
  if (source === "official") return "招聘官网";
  if (source === "demo") return "展示案例";
  if (source === "boss") return compact ? "BOSS直聘" : "BOSS直聘插件";
  return "手动添加";
}

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

const emptyForm = {
  title: "",
  company: "",
  salaryText: "",
  locationText: "",
  experienceText: "",
  educationText: "",
  sourceUrl: "",
  jobDescription: "",
};

function displayTime(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function capabilityTags(tags: string[]) {
  const basicCondition = /(学历|本科|硕士|博士|大专|专科|经验|应届|年龄|\d+\s*(?:年|岁))/;
  return tags.filter((tag) => !basicCondition.test(tag));
}

function createPreviewAnalysis(job: SavedJob): DisplayJobAnalysis {
  const skills = capabilityTags(job.skillTags);
  return {
    summary: job.jobDescription
      ? "岗位信息已同步。可点击重新分析，结合职业档案生成与该岗位相关的匹配证据和待补足项。"
      : "岗位信息已同步。补充岗位描述后，可结合职业档案生成更准确的匹配分析。",
    responsibilities: [],
    requirements: skills.length ? skills.slice(0, 6) : [job.experienceText || "工作经验待确认", job.educationText || "学历要求待确认"],
    hardRisks: [],
    matched: [],
    gaps: skills.length ? ["等待 AI 结合职业档案确认匹配情况"] : ["补充岗位 JD 后进行智能分析"],
    caveats: [],
  };
}

function analysisSignature(job: SavedJob, profile: ReturnType<typeof getAiProfile>) {
  const value = JSON.stringify({
    job: [job.updatedAt, job.title, job.company, job.jobDescription],
    profile,
  });
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  return (hash >>> 0).toString(36);
}

function readCachedAnalysis(job: SavedJob) {
  try {
    const cache = JSON.parse(window.localStorage.getItem(analysisCacheKey) || "{}") as Record<string, CachedJobAnalysis>;
    const entry = cache[job.id];
    return entry?.signature === analysisSignature(job, getAiProfile()) ? entry : null;
  } catch {
    return null;
  }
}

function saveCachedAnalysis(job: SavedJob, result: DisplayJobAnalysis) {
  try {
    const cache = JSON.parse(window.localStorage.getItem(analysisCacheKey) || "{}") as Record<string, CachedJobAnalysis>;
    cache[job.id] = {
      signature: analysisSignature(job, getAiProfile()),
      result,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(analysisCacheKey, JSON.stringify(cache));
  } catch { /* 存储不可用时仍保留当前页面结果 */ }
}

export default function SavedJobsWorkbench() {
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState("");
  const [selected, setSelected] = useState<SavedJob | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedInsight, setSelectedInsight] = useState<DisplayJobAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [greeting, setGreeting] = useState("");
  const [greetingJudgment, setGreetingJudgment] = useState<GreetingJudgment | null>(null);
  const [greetingAudience, setGreetingAudience] = useState<GreetingAudience>("招聘 HR");
  const [greetingAudienceOpen, setGreetingAudienceOpen] = useState(false);
  const [greetingLoading, setGreetingLoading] = useState(false);
  const [greetingError, setGreetingError] = useState("");
  const [greetingJob, setGreetingJob] = useState<SavedJob | null>(null);
  const [actionMenuJobId, setActionMenuJobId] = useState("");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const greetingAudienceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!greetingAudienceOpen) return;
    const closeAudienceMenu = (event: MouseEvent) => {
      if (!greetingAudienceRef.current?.contains(event.target as Node)) setGreetingAudienceOpen(false);
    };
    document.addEventListener("mousedown", closeAudienceMenu);
    return () => {
      document.removeEventListener("mousedown", closeAudienceMenu);
    };
  }, [greetingAudienceOpen]);

  useEffect(() => {
    if (!greetingJob) return;
    const closeGreetingByKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || greetingLoading) return;
      if (greetingAudienceOpen) setGreetingAudienceOpen(false);
      else setGreetingJob(null);
    };
    document.addEventListener("keydown", closeGreetingByKey);
    return () => document.removeEventListener("keydown", closeGreetingByKey);
  }, [greetingAudienceOpen, greetingJob, greetingLoading]);

  useEffect(() => {
    if (!actionMenuJobId) return;
    const closeActionMenu = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest(".job-action-select")) setActionMenuJobId("");
    };
    const closeActionMenuByKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActionMenuJobId("");
    };
    document.addEventListener("mousedown", closeActionMenu);
    document.addEventListener("keydown", closeActionMenuByKey);
    return () => {
      document.removeEventListener("mousedown", closeActionMenu);
      document.removeEventListener("keydown", closeActionMenuByKey);
    };
  }, [actionMenuJobId]);

  const loadJobs = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    if (isDemoMode()) {
      try {
        setJobs(await loadDemoJobs() as SavedJob[]);
        setSyncError("");
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : "读取本地岗位失败");
      } finally { setLoading(false); }
      return;
    }
    try {
      const response = await fetch("/api/jobs?limit=100", { cache: "no-store" });
      const data = await response.json() as { jobs?: SavedJob[]; error?: string };
      if (!response.ok) throw new Error(data.error || "同步失败");
      setJobs(data.jobs ?? []);
      setSyncError("");
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "同步失败");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadJobs(), 0);
    const timer = window.setInterval(() => void loadJobs(true), 3000);
    const refreshOnFocus = () => void loadJobs(true);
    window.addEventListener("focus", refreshOnFocus);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); window.removeEventListener("focus", refreshOnFocus); };
  }, [loadJobs]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesQuery = !value || [job.title, job.company, job.locationText, ...job.skillTags].join(" ").toLowerCase().includes(value);
      return matchesQuery && (statusFilter === "全部" || normalizedStatus(job.status) === statusFilter);
    });
  }, [jobs, query, statusFilter]);
  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !greetingJob) setSelected(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [greetingJob, selected]);

  async function analyzeSelected() {
    if (!selected) return;
    setAnalysisLoading(true);
    setAnalysisError("");
    try {
      const profile = getAiProfile();
      const result = await callAi<JobAnalysis>("/api/ai/job-analysis", { job: selected, profile });
      const displayResult: DisplayJobAnalysis = {
        ...result,
        matched: result.matched.map((item) => item.skill),
        gaps: result.gaps.map((item) => `${item.skill}：${item.reason}`),
      };
      setSelectedInsight(displayResult);
      saveCachedAnalysis(selected, displayResult);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "AI 分析失败");
    } finally {
      setAnalysisLoading(false);
    }
  }

  function openJob(job: SavedJob) {
    setSelected(job);
    setSelectedInsight(readCachedAnalysis(job)?.result ?? createPreviewAnalysis(job));
    setAnalysisError("");
    setGreetingError("");
    setStatusMenuOpen(false);
    const cachedGreeting = readCachedGreeting(job.id, greetingAudience);
    setGreeting(cachedGreeting?.greeting || "");
    setGreetingJudgment(cachedGreeting?.judgment || null);
  }

  async function updateSelectedStatus(status: string) {
    if (!selected) return;
    setStatusMenuOpen(false);
    if (isDemoMode()) {
      const updatedJob = { ...selected, status, updatedAt: new Date().toISOString() };
      setSelected(updatedJob);
      setJobs((current) => current.map((job) => job.id === updatedJob.id ? updatedJob : job));
      setNotice(`展示状态已更新为「${status}」`);
      return;
    }
    try {
      const response = await fetch("/api/jobs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, status }) });
      const data = await response.json() as { job?: SavedJob; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error || "更新失败");
      const updatedJob = data.job;
      setSelected(updatedJob);
      setJobs((current) => current.map((job) => job.id === updatedJob.id ? updatedJob : job));
      setNotice(`求职状态已更新为「${status}」`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "更新失败"); }
  }

  function openGreeting(job: SavedJob) {
    setActionMenuJobId("");
    setGreetingJob(job);
    setGreetingError("");
    const cachedGreeting = readCachedGreeting(job.id, greetingAudience);
    setGreeting(cachedGreeting?.greeting || "");
    setGreetingJudgment(cachedGreeting?.judgment || null);
  }

  function selectGreetingAudience(audience: GreetingAudience) {
    setGreetingAudience(audience);
    setGreetingAudienceOpen(false);
    if (!greetingJob) return;
    const cachedGreeting = readCachedGreeting(greetingJob.id, audience);
    setGreeting(cachedGreeting?.greeting || "");
    setGreetingJudgment(cachedGreeting?.judgment || null);
  }

  function updateGreetingDraft(value: string) {
    setGreeting(value);
    if (!greetingJob) return;
    try {
      saveCachedGreeting(greetingJob.id, greetingAudience, { greeting: value, judgment: greetingJudgment || undefined });
    } catch { /* 浏览器禁用本地存储时仍允许编辑 */ }
  }

  async function generateGreeting() {
    const targetJob = greetingJob ?? selected;
    if (!targetJob) return;
    setGreetingLoading(true);
    setGreetingError("");
    try {
      let analysis = readCachedAnalysis(targetJob)?.result ?? null;
      if (!analysis) {
        const result = await callAi<JobAnalysis>("/api/ai/job-analysis", { job: targetJob, profile: getAiProfile(), mode: "compact" });
        analysis = {
          summary: result.summary,
          responsibilities: [],
          requirements: [],
          hardRisks: result.hardRisks,
          matched: result.matched.map((item) => item.skill),
          gaps: result.gaps.map((item) => `${item.skill}：${item.reason}`),
          caveats: [],
        };
        saveCachedAnalysis(targetJob, analysis);
        if (selected?.id === targetJob.id) setSelectedInsight(analysis);
      }
      const result = await callAi<{ greeting: string; judgment?: GreetingJudgment }>("/api/ai/job-greeting", {
        job: targetJob,
        profile: getAiProfile(),
        analysis,
        audience: greetingAudience,
      });
      setGreeting(result.greeting);
      setGreetingJudgment(result.judgment || null);
      saveCachedGreeting(targetJob.id, greetingAudience, { greeting: result.greeting, judgment: result.judgment });
    } catch (error) {
      setGreetingError(error instanceof Error ? error.message : "招呼语生成失败");
    } finally {
      setGreetingLoading(false);
    }
  }

  async function copyGreeting() {
    if (!greeting) return;
    await navigator.clipboard.writeText(greeting);
    setNotice("招呼语已复制");
  }

  function createCustomizedResume(job: SavedJob) {
    setActionMenuJobId("");
    window.location.assign(`/resumes/new?job=${encodeURIComponent(job.id)}`);
  }

  function prepareInterview(job: SavedJob) {
    setActionMenuJobId("");
    window.location.assign(`/interviews?job=${encodeURIComponent(job.id)}`);
  }

  async function submitJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    if (isDemoMode()) {
      const now = new Date().toISOString();
      setJobs((current) => [{ id:`demo-manual-${Date.now()}`,source:"demo",companyLogoUrl:"",skillTags:[],status:"未投递",savedAt:now,updatedAt:now,...form }, ...current]);
      setShowAdd(false); setForm(emptyForm); setSaving(false); setNotice("已临时加入展示岗位（退出展示账号后不会保留）");
      return;
    }
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "manual" }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "保存失败");
      setShowAdd(false);
      setForm(emptyForm);
      setNotice("岗位已加入岗位库");
      await loadJobs(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected() {
    if (!selected || !window.confirm(`确认删除「${selected.title}」吗？`)) return;
    if (isDemoMode()) {
      setJobs((current) => current.filter((job) => job.id !== selected.id));
      setSelected(null); setNotice("已从本次展示中移除");
      return;
    }
    const response = await fetch(`/api/jobs?id=${encodeURIComponent(selected.id)}`, { method: "DELETE" });
    if (response.ok) {
      try {
        const cache = JSON.parse(window.localStorage.getItem(analysisCacheKey) || "{}") as Record<string, CachedJobAnalysis>;
        delete cache[selected.id];
        window.localStorage.setItem(analysisCacheKey, JSON.stringify(cache));
      } catch { /* 删除岗位不应被本地缓存阻塞 */ }
      setSelected(null);
      setNotice("岗位已删除");
      await loadJobs(true);
    } else {
      setNotice("删除失败，请稍后重试");
    }
  }

  function renderStatusPicker() {
    if (!selected) return null;
    return <div className="detail-status-picker"><button type="button" aria-haspopup="listbox" aria-expanded={statusMenuOpen} onClick={() => setStatusMenuOpen((open) => !open)}><span>{normalizedStatus(selected.status)}</span><IoChevronDownOutline /></button>{statusMenuOpen && <div className="detail-status-menu" role="listbox">{jobStatusOptions.map((status) => <button type="button" role="option" aria-selected={normalizedStatus(selected.status) === status} key={status} onClick={() => void updateSelectedStatus(status)}>{status}{normalizedStatus(selected.status) === status && <IoCheckmarkCircleOutline />}</button>)}</div>}</div>;
  }

  return (
    <main className="app-shell">
      <AppSidebar active="jobs" />

      <section className="workspace" id="jobs">
        <AppTopbar value={query} onChange={setQuery} placeholder="搜索岗位、公司…" status={<SyncStatus error={Boolean(syncError)} />} />

        <div className="content jobs-page-content">
          <div className="page-heading">
            <div><h1>收藏职位</h1></div>
            <button type="button" className="primary-button icon-text-button" onClick={() => setShowAdd(true)}><IoAddOutline /> 手动添加</button>
          </div>

          <section className="job-status-filter reference-status-cards" aria-label="按求职状态筛选">
            {[
              { label: "全部", icon: <IoBusinessOutline /> },
              { label: "未投递", icon: <IoChatbubbleEllipsesOutline /> },
              { label: "已投递", icon: <IoCheckmarkCircleOutline /> },
              { label: "面试中", icon: <IoChatbubblesOutline /> },
            ].map(({ label, icon }) => <button type="button" key={label} className={statusFilter === label ? "active" : ""} onClick={() => setStatusFilter(label)}><span>{label}</span><strong>{label === "全部" ? jobs.length : jobs.filter((job) => normalizedStatus(job.status) === label).length}</strong><i aria-hidden="true">{icon}</i></button>)}
          </section>

          <section className="jobs-card reference-jobs-card" aria-labelledby="saved-title">
            <div className="reference-jobs-tabs">
              {["全部", "未投递", "已投递", "面试中"].map((status) => <button type="button" key={status} className={statusFilter === status ? "active" : ""} onClick={() => setStatusFilter(status)}>{status} <b>{status === "全部" ? jobs.length : jobs.filter((job) => normalizedStatus(job.status) === status).length}</b></button>)}
              <span className="reference-list-actions"><button type="button" className="ghost-button icon-text-button"><IoFilterOutline />筛选 <IoChevronDownOutline /></button><button type="button" className="ghost-button icon-text-button" onClick={() => void loadJobs()} disabled={loading}>{!loading && <IoRefreshOutline />}最近收藏{loading && "（同步中…）"}<IoChevronDownOutline /></button></span>
            </div>
            {syncError && <div className="error-banner">暂时无法连接收藏数据：{syncError}</div>}
            {!loading && filtered.length === 0 ? (
              <div className="empty-state"><div className="empty-icon"><IoStarOutline /></div><h3>{query ? "没有匹配的岗位" : "还没有收藏岗位"}</h3><p>{query ? "换个关键词试试。" : "打开浏览器插件收藏职位，或在这里手动添加。"}</p>{!query && <button className="primary-button" type="button" onClick={() => setShowAdd(true)}>手动添加岗位</button>}</div>
            ) : (
              <div className="job-list">
                <div className="job-table-head"><span>职位信息</span><span>薪资</span><span>投递状态</span><span>求职操作</span><span /></div>
                {filtered.map((job) => (
                  <article className={`job-row${actionMenuJobId === job.id ? " action-menu-open" : ""}`} key={job.id}>
                    <div className="job-icon"><CompanyLogo company={job.company} logoUrl={job.companyLogoUrl} /></div>
                    <button type="button" className="job-main job-link" onClick={() => openJob(job)}><h3>{job.title}</h3><p>{job.company} · {job.locationText}</p><small>{sourceName(job.source)} · {displayTime(job.savedAt)}</small></button>
                    <strong className="salary">{job.salaryText}</strong>
                    <span className={`status status-${normalizedStatus(job.status)}`}>{normalizedStatus(job.status)}</span>
                    <div className="job-action-select">
                      <button type="button" className="job-action-trigger" aria-haspopup="menu" aria-expanded={actionMenuJobId === job.id} onClick={() => setActionMenuJobId((current) => current === job.id ? "" : job.id)}><span>求职操作</span><IoChevronDownOutline /></button>
                      {actionMenuJobId === job.id && <div className="job-action-menu" role="menu" aria-label={`${job.title}求职操作`}>
                        <button type="button" role="menuitem" onClick={() => openGreeting(job)}><IoChatbubbleEllipsesOutline /><span><strong>生成招呼语</strong><small>生成并复制招聘平台开场消息</small></span></button>
                        <button type="button" role="menuitem" onClick={() => createCustomizedResume(job)}><IoDocumentTextOutline /><span><strong>生成定制简历</strong><small>根据岗位 JD 调整经历与表达</small></span></button>
                        <button type="button" role="menuitem" onClick={() => prepareInterview(job)}><IoChatbubblesOutline /><span><strong>面试准备</strong><small>生成问题清单并填写回答</small></span></button>
                      </div>}
                    </div>
                    <button type="button" className="row-action" onClick={() => openJob(job)} aria-label={`查看${job.title}`}>›</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>

      {showAdd && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAdd(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-title"><div className="modal-head"><div><p className="eyebrow">手动录入</p><h2 id="add-title">添加收藏岗位</h2></div><button type="button" className="icon-button" onClick={() => setShowAdd(false)} aria-label="关闭"><IoCloseOutline /></button></div><form className="job-form" onSubmit={submitJob}><label>职位名称<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例如：Web前端工程师" /></label><label>公司名称<input required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="例如：酷巢科技" /></label><div className="form-grid"><label>薪资<input value={form.salaryText} onChange={(e) => setForm({ ...form, salaryText: e.target.value })} placeholder="8–13K" /></label><label>地点<input value={form.locationText} onChange={(e) => setForm({ ...form, locationText: e.target.value })} placeholder="杭州" /></label><label>经验<input value={form.experienceText} onChange={(e) => setForm({ ...form, experienceText: e.target.value })} placeholder="1–3年" /></label><label>学历<input value={form.educationText} onChange={(e) => setForm({ ...form, educationText: e.target.value })} placeholder="本科" /></label></div><label>职位链接<input type="url" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://…（可选）" /></label><label>岗位描述<textarea rows={5} value={form.jobDescription} onChange={(e) => setForm({ ...form, jobDescription: e.target.value })} placeholder="粘贴 JD 内容（可选）" /></label><div className="modal-actions"><button type="button" className="ghost-button" onClick={() => setShowAdd(false)}>取消</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "保存中…" : "收藏岗位"}</button></div></form></section></div>}

      {selected && !selectedInsight && <div className="modal-backdrop job-analysis-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !analysisLoading) setSelected(null); }}><section className="job-analysis-modal job-analysis-prompt compact-analysis-prompt" role="dialog" aria-modal="true" aria-labelledby="analysis-prompt-title"><header className="job-analysis-head"><div className="job-analysis-company-logo">{selected.companyLogoUrl ? <img src={selected.companyLogoUrl} alt={`${selected.company} Logo`} referrerPolicy="no-referrer" /> : <IoBusinessOutline />}</div><div className="job-analysis-heading"><h2 id="analysis-prompt-title">{selected.title}</h2><p>{selected.company}</p></div><strong className="job-analysis-salary">{selected.salaryText || "薪资面议"}</strong>{renderStatusPicker()}<button type="button" className="icon-button" disabled={analysisLoading} onClick={() => setSelected(null)} aria-label="关闭"><IoCloseOutline /></button></header><div className="compact-analysis-body"><div className="job-facts"><span><IoLocationOutline />{selected.locationText || "地点待确认"}</span></div><details className="original-jd"><summary>查看原始岗位描述</summary><p>{selected.jobDescription || "暂未保存岗位描述，可打开原职位后通过插件重新同步。"}</p></details>{analysisError && <div className="ai-profile-error"><IoAlertCircleOutline /><span>{analysisError}</span>{analysisError.includes("设置") && <a href="/settings">前往设置</a>}</div>}<button type="button" className="analysis-mini-button" disabled={analysisLoading} onClick={() => void analyzeSelected()}><IoSparklesOutline />{analysisLoading ? "分析中…" : analysisError ? "重新分析" : "AI 分析"}</button></div><footer className="job-analysis-actions"><button type="button" className="danger-button" onClick={() => void deleteSelected()}>删除收藏</button><span className="action-spacer" />{selected.sourceUrl.startsWith("http") && <button type="button" className="ghost-button" onClick={() => window.open(selected.sourceUrl, "_blank", "noopener,noreferrer")}>打开原职位</button>}<button type="button" className="primary-button" onClick={() => setSelected(null)}>完成</button></footer></section></div>}

      {selected && selectedInsight && <div className="modal-backdrop job-analysis-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        <section className="job-analysis-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <header className="job-analysis-head">
            <div className="job-analysis-company-logo"><CompanyLogo company={selected.company} logoUrl={selected.companyLogoUrl} /></div>
            <div className="job-analysis-heading"><div><span className="analysis-label"><IoSparklesOutline /> AI 岗位分析</span></div><h2 id="detail-title">{selected.title}</h2><p>{selected.company}</p></div>
            <strong className="job-analysis-salary">{selected.salaryText || "薪资面议"}</strong>
            {renderStatusPicker()}
            <button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label="关闭"><IoCloseOutline /></button>
          </header>
          <div className="job-analysis-scroll">
            <div className="job-facts"><span><IoLocationOutline />{selected.locationText || "地点待确认"}</span>{capabilityTags(selected.skillTags).slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}</div>
            <section className="job-summary-strip"><div><IoSparklesOutline /><strong>这个岗位在做什么</strong></div><p>{selectedInsight.summary}</p><button type="button" className="analysis-mini-button" disabled={analysisLoading} onClick={() => void analyzeSelected()}><IoSparklesOutline />{analysisLoading ? "分析中…" : "重新分析"}</button></section>
            <section className="ability-overview-grid">
              <article className="requirement-overview-card"><div className="analysis-section-title"><IoDocumentTextOutline /><h3>岗位需要什么</h3></div><div className="analysis-skill-list neutral">{selectedInsight.requirements.map((item) => <span key={item}>{item}</span>)}</div></article>
              <article className="skill-match-card"><div className="analysis-section-title positive"><IoCheckmarkCircleOutline /><h3>你已经具备</h3></div><div className="analysis-skill-list">{selectedInsight.matched.map((item) => <span key={item}>{item}</span>)}</div><small>来自职业档案中的事实证据。</small></article>
              <article className="skill-gap-card"><div className="analysis-section-title warning"><IoAlertCircleOutline /><h3>待补足或确认</h3></div><ul>{selectedInsight.gaps.map((item) => <li key={item}>{item}</li>)}</ul></article>
            </section>
            {selectedInsight.hardRisks?.length > 0 && <section className="hard-risk-overview"><div className="analysis-section-title warning"><IoAlertCircleOutline /><h3>硬性风险</h3></div><div>{selectedInsight.hardRisks.map((item) => <article key={`${item.type}-${item.label}`}><strong>{item.label}</strong><p>{item.reason}</p></article>)}</div></section>}
            <details className="original-jd" open><summary>原始岗位描述</summary><p>{selected.jobDescription || "暂未保存岗位描述，可返回招聘页面重新同步。"}</p></details>
            <div className="detail-meta">收藏于 {displayTime(selected.savedAt)} · 来源：{sourceName(selected.source, true)}</div>
          </div>
          <footer className="job-analysis-actions"><button type="button" className="danger-button" onClick={() => void deleteSelected()}>删除收藏</button><span className="action-spacer" /><button type="button" className="ghost-button icon-text-button" onClick={() => openGreeting(selected)}><IoChatbubbleEllipsesOutline />生成招呼语</button>{selected.sourceUrl.startsWith("http") && <button type="button" className="ghost-button" onClick={() => window.open(selected.sourceUrl, "_blank", "noopener,noreferrer")}>打开原职位</button>}<button type="button" className="primary-button" onClick={() => setSelected(null)}>完成</button></footer>
        </section>
      </div>}
      {greetingJob && <div className="modal-backdrop job-utility-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !greetingLoading) setGreetingJob(null); }}><section className={`job-utility-dialog ${greeting ? "has-greeting" : "is-empty"}`} role="dialog" aria-modal="true" aria-labelledby="greeting-dialog-title"><header><div><span><IoChatbubbleEllipsesOutline /></span><div><p>求职操作 · 生成招呼语</p><h2 id="greeting-dialog-title">{greetingJob.title}</h2><small>{greetingJob.company}</small></div></div><button type="button" className="icon-button" aria-label="关闭" disabled={greetingLoading} onClick={() => setGreetingJob(null)}><IoCloseOutline /></button></header><div className="job-utility-content"><div className="utility-tone-row"><div><strong>沟通对象</strong><small>按角色切换首句判断重点，不套用固定的亮点排序</small></div><div className="workbench-select greeting-audience-select" ref={greetingAudienceRef}><button type="button" className="workbench-select-trigger" aria-label="选择招呼语沟通对象" aria-haspopup="listbox" aria-expanded={greetingAudienceOpen} onClick={() => setGreetingAudienceOpen((current) => !current)}><span>{greetingAudience}</span><IoChevronDownOutline /></button>{greetingAudienceOpen && <div className="workbench-select-menu" role="listbox" aria-label="招呼语沟通对象">{greetingAudienceOptions.map((option) => <button type="button" role="option" aria-selected={greetingAudience === option.label} className={greetingAudience === option.label ? "selected" : ""} key={option.label} onClick={() => selectGreetingAudience(option.label)}><span><strong>{option.label}</strong><small>{option.description}</small></span>{greetingAudience === option.label && <IoCheckmarkCircleOutline />}</button>)}</div>}</div></div>{greetingJudgment && <section className="greeting-judgment" aria-label="本次招呼语判断依据"><header><span>{greetingJudgment.confidence}</span><strong>本次首句判断</strong></header><dl><div><dt>沟通策略</dt><dd>{greetingJudgment.strategy}</dd></div><div><dt>采用亮点</dt><dd>{greetingJudgment.highlight}</dd></div><div><dt>判断依据</dt><dd>{greetingJudgment.reason}</dd></div></dl></section>}{greeting ? <textarea value={greeting} onChange={(event) => updateGreetingDraft(event.target.value)} aria-label="定制化招呼语" /> : <div className="greeting-empty"><IoSparklesOutline /><strong>先判断，再生成针对当前岗位的开场消息</strong><p>系统会结合岗位要求、职业档案和沟通对象，判断是否存在值得放在首句的真实亮点。</p></div>}{greetingError && <div className="greeting-error">{greetingError}</div>}</div><footer><button type="button" className="ghost-button" disabled={greetingLoading} onClick={() => setGreetingJob(null)}>取消</button><button type="button" className="ghost-button icon-text-button" disabled={greetingLoading} onClick={() => void generateGreeting()}><IoSparklesOutline />{greetingLoading ? "正在分析并生成…" : greeting ? "重新判断并生成" : "分析并生成"}</button>{greeting && <button type="button" className="primary-button icon-text-button" onClick={() => void copyGreeting()}><IoCopyOutline />复制招呼语</button>}</footer></section></div>}
      {notice && <div className="toast" role="status">✓ {notice}</div>}
    </main>
  );
}
