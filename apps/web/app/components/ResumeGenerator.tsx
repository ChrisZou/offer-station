"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  IoAlertCircleOutline,
  IoBriefcaseOutline,
  IoCheckmarkCircleOutline,
  IoCheckmarkOutline,
  IoChevronDownOutline,
  IoInformationCircleOutline,
  IoLocationOutline,
  IoSparklesOutline,
} from "react-icons/io5";
import { AppSidebar, AppTopbar } from "./AppChrome";
import {
  callAi,
  GENERATED_RESUME_STORAGE,
  getAiProfile,
  type AiProfile,
  type GeneratedResume,
} from "../lib/ai-client";
import { isDemoMode, loadDemoJobs } from "../lib/demo-data";

type SavedJob = {
  id: string;
  title: string;
  company: string;
  salaryText: string;
  locationText: string;
  experienceText: string;
  educationText: string;
  jobDescription: string;
  skillTags: string[];
};

type SourceCard = {
  id: string;
  archiveIndex: number;
  type: string;
  title: string;
  detail: string;
  tags: string[];
  facts: string[];
  evidence: string[];
  aiScore?: number;
  aiReason?: string;
  recommended?: boolean;
};

type ResumePlan = {
  jobSummary: string;
  requiredSkills: string[];
  requiredExperience: string[];
  overallMatch: number;
  scoreReason: string;
  recruitmentLogic: Array<{
    dimension: string;
    status: "covered" | "partial" | "missing";
    conclusion: string;
    basis: string;
  }>;
  requirementCoverage: Array<{
    requirement: string;
    category: string;
    status: "covered" | "partial" | "missing";
    evidence: string;
  }>;
  improvementPriorities: Array<{
    action: string;
    priority: "high" | "medium" | "low";
    reason: string;
  }>;
  structure: {
    stage: "student_recent" | "early_career" | "experienced" | "academic";
    stageLabel: string;
    sectionOrder: string[];
    reason: string;
  };
  materials: Array<{ archiveIndex: number; score: number; reason: string; recommended: boolean }>;
};

const typeOptions = ["全部素材", "项目经历", "工作经历", "教育与证书", "成果与作品"] as const;
const coverageCategories = ["硬性要求", "核心职责", "加分条件", "量化成果"] as const;
const fitStatusLabels = { covered: "明确匹配", partial: "部分匹配", missing: "尚未体现" } as const;
const priorityLabels = { high: "高", medium: "中", low: "低" } as const;
const RESUME_GENERATOR_DRAFT_STORAGE = "job-workbench.resume-generator-draft";

function matchesType(card: SourceCard, value: typeof typeOptions[number]) {
  if (value === "全部素材") return true;
  if (value === "教育与证书") return card.type === "教育经历";
  if (value === "成果与作品") return card.type === "成果证明";
  return card.type === value;
}

export default function ResumeGenerator() {
  const [profile, setProfile] = useState<AiProfile | null>(null);
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [sourceCards, setSourceCards] = useState<SourceCard[]>([]);
  const [activeType, setActiveType] = useState<typeof typeOptions[number]>("全部素材");
  const [query, setQuery] = useState("");
  const [onlyRecommended, setOnlyRecommended] = useState(false);
  const [onlyWithResults, setOnlyWithResults] = useState(false);
  const [onlyMissingEvidence, setOnlyMissingEvidence] = useState(false);
  const [plan, setPlan] = useState<ResumePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [draftNotice, setDraftNotice] = useState("");
  const jobPickerRef = useRef<HTMLDivElement>(null);

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;

  useEffect(() => {
    let active = true;
    const profileTimer = window.setTimeout(() => {
      const currentProfile = getAiProfile();
      if (!active) return;
      setProfile(currentProfile);
      if (currentProfile) {
        const cards = currentProfile.archives.map((item, index) => ({
          id: `profile-${index}`,
          archiveIndex: index,
          type: item.type,
          title: item.title,
          detail: item.description || item.subtitle,
          tags: item.skills,
          facts: item.facts,
          evidence: item.evidence,
        }));
        setSourceCards(cards);
        try {
          const saved = window.localStorage.getItem(RESUME_GENERATOR_DRAFT_STORAGE);
          if (saved) {
            const parsed = JSON.parse(saved) as {
              selectedJobId?: string;
              selected?: string[];
              activeType?: typeof typeOptions[number];
            };
            setSelectedJobId(parsed.selectedJobId || "");
            setSelected((parsed.selected || []).filter((id) => cards.some((card) => card.id === id)));
            if (parsed.activeType && typeOptions.includes(parsed.activeType)) setActiveType(parsed.activeType);
            setDraftNotice("已恢复上次保存的准备进度");
          } else setSelected(cards.map((card) => card.id));
        } catch { setSelected(cards.map((card) => card.id)); }
      }
    }, 0);
    const jobsTimer = window.setTimeout(async () => {
      if (isDemoMode()) {
        const loadedJobs = await loadDemoJobs() as SavedJob[];
        setJobs(loadedJobs);
        const requestedJobId = new URLSearchParams(window.location.search).get("job");
        if (requestedJobId && loadedJobs.some((job) => job.id === requestedJobId)) setSelectedJobId(requestedJobId);
        return;
      }
      fetch("/api/jobs?limit=100", { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json() as { jobs?: SavedJob[]; error?: string };
          if (!response.ok) throw new Error(data.error || "读取岗位失败");
          if (active) {
            const loadedJobs = data.jobs ?? [];
            setJobs(loadedJobs);
            const requestedJobId = new URLSearchParams(window.location.search).get("job");
            if (requestedJobId && loadedJobs.some((job) => job.id === requestedJobId)) setSelectedJobId(requestedJobId);
          }
        })
        .catch((error: unknown) => {
          if (active) setLoadError(error instanceof Error ? error.message : "读取岗位失败");
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(profileTimer);
      window.clearTimeout(jobsTimer);
    };
  }, []);

  useEffect(() => {
    if (!jobPickerOpen) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (!jobPickerRef.current?.contains(event.target as Node)) setJobPickerOpen(false);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setJobPickerOpen(false);
    };
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [jobPickerOpen]);

  const typeCount = (type: typeof typeOptions[number]) => sourceCards.filter((card) => matchesType(card, type)).length;
  const filteredCards = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return sourceCards.filter((card) => {
      if (!matchesType(card, activeType)) return false;
      if (keyword && !`${card.title} ${card.detail} ${card.tags.join(" ")}`.toLowerCase().includes(keyword)) return false;
      if (onlyRecommended && !card.recommended) return false;
      if (onlyWithResults && !card.facts.length) return false;
      if (onlyMissingEvidence && card.evidence.length) return false;
      return true;
    });
  }, [activeType, onlyMissingEvidence, onlyRecommended, onlyWithResults, query, sourceCards]);

  const toggle = (id: string) => setSelected((value) => value.includes(id)
    ? value.filter((item) => item !== id)
    : [...value, id]);

  function toggleAllSources() {
    setSelected((current) => current.length === sourceCards.length ? [] : sourceCards.map((card) => card.id));
  }

  function changeJob(id: string) {
    setSelectedJobId(id);
    setJobPickerOpen(false);
    setSelected(sourceCards.map((card) => card.id));
    setPlan(null);
    setAnalysisError("");
    setOnlyRecommended(false);
    setSourceCards((cards) => cards.map((card) => ({
      id: card.id,
      archiveIndex: card.archiveIndex,
      type: card.type,
      title: card.title,
      detail: card.detail,
      tags: card.tags,
      facts: card.facts,
      evidence: card.evidence,
    })));
  }

  function savePreparationDraft() {
    window.localStorage.setItem(RESUME_GENERATOR_DRAFT_STORAGE, JSON.stringify({
      selectedJobId,
      selected,
      activeType,
      savedAt: new Date().toISOString(),
    }));
    setDraftNotice("准备进度已保存");
    window.setTimeout(() => setDraftNotice(""), 2200);
  }

  async function analyzeAndSelect() {
    if (!selectedJob) {
      setAnalysisError("请先选择一个已收藏岗位");
      return;
    }
    if (!profile?.archives.length) {
      setAnalysisError("请先创建职业档案并添加经历");
      return;
    }
    setLoading(true);
    setAnalysisError("");
    try {
      const result = await callAi<ResumePlan>("/api/ai/resume-plan", { job: selectedJob, profile });
      const materialMap = new Map(result.materials.map((item) => [item.archiveIndex, item]));
      setSourceCards((cards) => cards.map((card) => {
        const material = materialMap.get(card.archiveIndex);
        return material ? {
          ...card,
          aiScore: material.score,
          aiReason: material.reason,
          recommended: material.recommended,
        } : { ...card, aiScore: 0, aiReason: "与该岗位暂无明确关联", recommended: false };
      }));
      setSelected(sourceCards.filter((card) => materialMap.get(card.archiveIndex)?.recommended).map((card) => card.id));
      setPlan(result);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "AI 分析失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function generateResume() {
    if (!selectedJob || !profile) {
      setGenerationError("请先选择岗位并准备职业档案");
      return;
    }
    const selectedArchives = selectedCards
      .map((card) => profile.archives[card.archiveIndex])
      .filter(Boolean);
    if (!selectedArchives.length) {
      setGenerationError("请至少选择一条经历");
      return;
    }
    setGenerating(true);
    setGenerationError("");
    try {
      const content = await callAi<Omit<GeneratedResume, "job" | "personalInfo" | "match" | "createdAt">>("/api/ai/resume-generate", {
        job: selectedJob,
        selectedArchives,
      });
      const draft: GeneratedResume = {
        ...content,
        job: { id: selectedJob.id, title: selectedJob.title, company: selectedJob.company },
        personalInfo: profile.personalInfo ?? {},
        match: plan?.overallMatch ?? 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(GENERATED_RESUME_STORAGE, JSON.stringify(draft));
      window.localStorage.removeItem(`${GENERATED_RESUME_STORAGE}.html`);
      window.location.assign("/resumes/frontend-v3/edit");
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "生成简历失败，请稍后重试");
      setGenerating(false);
    }
  }

  const selectedCards = sourceCards.filter((item) => selected.includes(item.id));
  const match = plan?.overallMatch ?? 0;
  const requirementCoverage = plan?.requirementCoverage ?? [];
  const coverageCounts = {
    covered: requirementCoverage.filter((item) => item.status === "covered").length,
    partial: requirementCoverage.filter((item) => item.status === "partial").length,
    missing: requirementCoverage.filter((item) => item.status === "missing").length,
  };
  const coverageTotal = requirementCoverage.length;

  return <main className="app-shell resume-shell"><AppSidebar active="resumes" />
    <section className="workspace"><AppTopbar />
      <div className="resume-page"><div className="resume-page-heading"><div className="resume-heading-main"><Link className="resume-back" href="/resumes">← 简历管理</Link><h1>生成岗位专属简历</h1><div className="resume-heading-note"><p>选择与岗位匹配的真实经历</p><button className="generation-principle-trigger" type="button" aria-label="查看简历生成原则" aria-describedby="generation-principle-tooltip"><IoInformationCircleOutline /><span id="generation-principle-tooltip" role="tooltip"><strong>生成原则</strong>事实优先，表达重组；不添加未经确认的技能、经历或成果。</span></button></div></div><div className="generator-draft-action">{draftNotice && <span role="status"><IoCheckmarkCircleOutline /> {draftNotice}</span>}<button className="text-button" type="button" onClick={savePreparationDraft}>保存草稿</button></div></div>
        <div className="resume-steps"><span className={profile ? "done" : "active"}>1 <b>准备档案</b></span><i /><span className={selectedJob ? "done" : profile ? "active" : ""}>2 <b>选择岗位</b></span><i /><span className={plan ? "done" : selectedJob ? "active" : ""}>3 <b>AI 选择素材</b></span><i /><span>4 <b>生成与编辑</b></span></div>

        <section className="generator-context">
          <div className="generator-job-picker"><small>目标岗位</small><div className={`job-picker ${jobPickerOpen ? "open" : ""}`} ref={jobPickerRef}><button className="job-picker-trigger" type="button" aria-haspopup="listbox" aria-expanded={jobPickerOpen} onClick={() => setJobPickerOpen((value) => !value)}><span className="job-picker-icon"><IoBriefcaseOutline /></span><span className="job-picker-value"><strong>{selectedJob?.title || "选择一个已收藏岗位"}</strong>{selectedJob && <small title={selectedJob.company}>{selectedJob.company}</small>}</span><IoChevronDownOutline className="job-picker-chevron" /></button>{jobPickerOpen && <div className="job-picker-menu" role="listbox" aria-label="已收藏岗位">{jobs.length ? jobs.map((job) => <button type="button" role="option" aria-selected={selectedJobId === job.id} className={selectedJobId === job.id ? "selected" : ""} onClick={() => changeJob(job.id)} key={job.id}><span className="job-picker-option-icon"><IoBriefcaseOutline /></span><span><strong title={job.title}>{job.title}</strong><small title={`${job.company} · ${job.locationText}`}><span className="job-option-company">{job.company}</span><i>·</i><span className="job-option-location"><IoLocationOutline /><span>{job.locationText}</span></span></small></span>{selectedJobId === job.id && <IoCheckmarkOutline className="job-picker-check" />}</button>) : <div className="job-picker-empty">岗位库暂无收藏</div>}</div>}</div><span className="job-picker-helper" title={selectedJob ? `${selectedJob.company} · ${selectedJob.locationText}` : undefined}>{selectedJob ? `${selectedJob.company} · ${selectedJob.locationText}` : loadError || (jobs.length ? "从岗位库选择目标岗位" : "收藏岗位后会显示在这里")}</span></div>
          <div><small>职业档案</small><strong>{sourceCards.length ? `已读取 ${sourceCards.length} 项` : "尚未创建"}</strong><span>{sourceCards.length ? "AI 只会使用档案中的真实经历" : "先导入简历或添加真实经历"}</span></div>
        </section>

        <section className={`resume-job-insight ${plan ? "ready" : "compact"}`}>
          <header><div><span><IoSparklesOutline /></span><div><small>岗位理解</small><h2>{selectedJob ? selectedJob.title : "选择目标岗位"}</h2></div>{!plan && <em>{selectedJob ? "尚未分析" : "待选择"}</em>}</div>{selectedJob && <button type="button" onClick={analyzeAndSelect} disabled={loading || !sourceCards.length}><IoSparklesOutline /> {loading ? "分析中…" : plan ? "重新分析" : "分析并选择经历"}</button>}</header>
          {plan && <div className="resume-job-insight-body"><p className="job-purpose"><strong>岗位重点</strong>{plan.jobSummary}</p><div className="job-need-grid"><article><h3>需要的技能</h3><div>{plan.requiredSkills.map((item) => <span key={item}>{item}</span>)}</div></article><article><h3>需要的经历</h3><ul>{plan.requiredExperience.map((item) => <li key={item}>{item}</li>)}</ul></article></div><div className="resume-structure-preview"><div><strong>推荐顺序</strong><span>{plan.structure.stageLabel}</span></div><p>{plan.structure.sectionOrder.filter((item) => item !== "其他经历").join(" → ")}</p></div></div>}
          {analysisError && <div className="generator-error" role="alert"><IoAlertCircleOutline /> {analysisError}</div>}
        </section>

        <div className="generator-layout"><aside className="generator-filter"><h2>素材范围</h2><label className="filter-search">⌕ <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索经历或能力" disabled={!sourceCards.length} /></label><h3>内容类型</h3>{typeOptions.map((item) => <button type="button" className={activeType === item ? "active" : ""} disabled={!sourceCards.length} onClick={() => setActiveType(item)} key={item}>{item} <span>{typeCount(item)}</span></button>)}<h3>筛选方式</h3><label><input checked={onlyRecommended} onChange={(event) => setOnlyRecommended(event.target.checked)} disabled={!plan} type="checkbox" /> AI 推荐</label><label><input checked={onlyWithResults} onChange={(event) => setOnlyWithResults(event.target.checked)} disabled={!sourceCards.length} type="checkbox" /> 有关键成果</label><label><input checked={onlyMissingEvidence} onChange={(event) => setOnlyMissingEvidence(event.target.checked)} disabled={!sourceCards.length} type="checkbox" /> 需要补充证明</label></aside>
          <section className="generator-cards"><div className="generator-section-head"><h2>选择简历素材</h2><div className="generator-selection-actions"><button className="select-all-button" type="button" onClick={toggleAllSources} disabled={!sourceCards.length}><IoCheckmarkOutline /> {selected.length === sourceCards.length && sourceCards.length ? "取消全选" : "全选经历"}</button><button type="button" onClick={analyzeAndSelect} disabled={loading || !selectedJob || !sourceCards.length}><IoSparklesOutline /> {loading ? "分析中" : "AI 智能选择经历"}</button></div></div>{filteredCards.length ? filteredCards.map((card) => <label className={`source-card ${selected.includes(card.id) ? "selected" : ""}`} key={card.id}><input type="checkbox" checked={selected.includes(card.id)} onChange={() => toggle(card.id)} /><div><span>{card.type}</span>{card.recommended && <b className="ai-recommended">AI 推荐</b>}<h3>{card.title}</h3><p>{card.detail}</p>{card.aiReason && <p className="source-card-reason" title={card.aiReason}>{card.aiReason}</p>}<div>{card.tags.map((tag) => <em key={tag}>{tag}</em>)}</div></div><strong className={typeof card.aiScore === "number" ? "" : "pending"}>{typeof card.aiScore === "number" ? card.aiScore : "--"}<small>{typeof card.aiScore === "number" ? "% 相关" : "待 AI 分析"}</small></strong></label>) : sourceCards.length ? <div className="generator-empty compact"><h3>没有符合当前筛选的素材</h3><p>调整左侧素材范围或清空搜索条件后再试。</p></div> : <div className="generator-empty"><h3>还没有可用素材</h3><p>先创建职业档案并确认其中的事实，再回来生成岗位专属简历。</p><Link className="primary-button button-link" href="/profile">创建职业档案</Link></div>}</section>
          <aside className="generator-summary"><header className="summary-heading"><div><h2>岗位适配分析</h2><small>基于 JD 与档案证据</small></div></header><section className="match-overview"><div className={`coverage-ring ${plan ? "ready" : ""}`} style={{ "--coverage": `${match * 3.6}deg` } as CSSProperties}><strong>{plan ? `${match}%` : "--"}</strong><span>岗位适配度</span></div><div><b>{plan ? match >= 75 ? "匹配度较高" : match >= 50 ? "中等匹配" : "匹配度偏低" : "等待分析"}</b><p>{plan?.scoreReason || "完成 AI 分析后，将依据岗位要求和职业档案中的直接证据生成判断。"}</p></div></section>
            <section className="recruitment-logic"><div className="summary-section-title"><h3>招聘逻辑拆解</h3>{plan?.recruitmentLogic?.length ? <small>点击胶囊展开依据</small> : null}</div>{plan?.recruitmentLogic?.length ? <div className="logic-list">{plan.recruitmentLogic.map((item) => <details className={`logic-item ${item.status}`} key={item.dimension}><summary><i aria-hidden="true" /><span><b>{item.dimension}</b><small>{fitStatusLabels[item.status]}</small></span><em>{item.conclusion || fitStatusLabels[item.status]}<IoChevronDownOutline aria-hidden="true" /></em></summary><p><strong>判断依据</strong>{item.basis}</p></details>)}</div> : <div className="analysis-placeholder">分析后展示硬性门槛、核心职责、能力证据、相关项目与量化成果。</div>}</section>
            <section className="requirement-coverage"><div className="summary-section-title"><h3>岗位要求覆盖</h3>{coverageTotal > 0 && <small>{coverageCounts.covered}/{coverageTotal} 明确覆盖</small>}</div>{coverageTotal > 0 ? <><div className="coverage-bar" role="img" aria-label={`明确匹配${coverageCounts.covered}项，部分匹配${coverageCounts.partial}项，尚未体现${coverageCounts.missing}项`}><i className="covered" style={{ width: `${coverageCounts.covered / coverageTotal * 100}%` }} /><i className="partial" style={{ width: `${coverageCounts.partial / coverageTotal * 100}%` }} /><i className="missing" style={{ width: `${coverageCounts.missing / coverageTotal * 100}%` }} /></div><div className="coverage-legend"><span className="covered">明确匹配 <b>{coverageCounts.covered}</b></span><span className="partial">部分匹配 <b>{coverageCounts.partial}</b></span><span className="missing">尚未体现 <b>{coverageCounts.missing}</b></span></div><div className="coverage-category-list">{coverageCategories.map((category) => { const items = requirementCoverage.filter((item) => item.category === category); const covered = items.filter((item) => item.status === "covered").length; return items.length ? <div key={category}><span>{category}</span><i><em style={{ width: `${covered / items.length * 100}%` }} /></i><b>{covered}/{items.length}</b></div> : null; })}</div></> : <div className="analysis-placeholder">分析后按硬性要求、核心职责、加分条件和量化成果展示覆盖情况。</div>}</section>
            {plan?.improvementPriorities?.length ? <section className="improvement-priorities"><h3>优先改进项</h3><ol>{plan.improvementPriorities.map((item, index) => <li key={`${item.action}-${index}`} title={item.reason}><span>{index + 1}</span><p>{item.action}</p><em className={item.priority}>{priorityLabels[item.priority]}优先级</em></li>)}</ol></section> : null}
            <details className="selected-materials"><summary>已选素材 <b>{selectedCards.length}</b></summary>{selectedCards.length ? <ol>{selectedCards.map((item) => <li key={item.id}>{item.title}<button type="button" aria-label={`移除${item.title}`} onClick={() => toggle(item.id)}>×</button></li>)}</ol> : <div className="selected-empty">尚未选择经历</div>}</details>{generationError && <div className="summary-generation-error" role="alert"><IoAlertCircleOutline /> {generationError}</div>}<button className="generate-button" type="button" onClick={generateResume} disabled={generating || !selectedJob || !selected.length}>{generating ? "AI 正在生成…" : "生成岗位定制简历"} {!generating && <span>→</span>}</button></aside></div>
      </div></section></main>;
}
